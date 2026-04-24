import { prisma } from "@/lib/prisma";
import type {
  CatalogHealthResponse,
  ContactChannelItem,
  ConversationDetailItem,
  ConversationDetailResponse,
  ConversationMessageItem,
  DashboardSummaryResponse,
  InboxConversationItem,
  InboxListResponse,
  LatestSyncSummary,
  PoliciesContactResponse,
  PolicyMap,
  ProductListItem,
  ProductsListResponse,
  TenantPanelContext,
  VariantListItem,
  VariantsListResponse,
} from "./types";

type TenantContextRow = {
  tenant_id: string;
  brand_name: string | null;
  wa_phone_number_id: string | null;
  store_name: string | null;
  merchant_id: string | null;
  source_platform: string | null;
};

type CountRow = { count: number | string | null };

type LatestSyncRow = {
  status: string | null;
  finished_at: Date | string | null;
  error_count: number | string | null;
};

type ProductRow = {
  id: string;
  name: string | null;
  handle: string | null;
  category: string | null;
  subcategory: string | null;
  base_price: number | string | null;
  display_price: number | string | null;
  currency: string | null;
  stock_status: string | null;
  is_active: boolean | null;
  short_description: string | null;
  variant_count: number | string | null;
  attributes: Record<string, unknown> | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  product_name: string | null;
  sku: string | null;
  title: string | null;
  color: string | null;
  size: string | null;
  price: number | string | null;
  stock_qty: number | string | null;
  stock_status: string | null;
  is_active: boolean | null;
};

type PolicyRow = { policy_key: string; policy_text: string | null };

type ContactRow = {
  id: string;
  channel_key: string | null;
  label: string | null;
  value: string | null;
  contact_url: string | null;
  availability_text: string | null;
  is_primary: boolean | null;
  is_active: boolean | null;
  priority: number | string | null;
};

type SenderType = "customer" | "ai" | "operator" | "system" | null;

type InboxConversationRow = {
  conversation_id: string;
  member_id: string | null;
  customer_id: string | null;
  channel: string | null;
  status: string | null;
  context_product_name: string | null;
  last_message_at: Date | string | null;
  last_message_text: string | null;
  last_message_direction: "in" | "out" | null;
  last_message_sender_type: SenderType;
  last_customer_message_at: Date | string | null;
  last_operator_message_at: Date | string | null;
  operator_reviewed_at: Date | string | null;
  operator_reviewed_by: string | null;
  operator_review_note: string | null;
  operator_note: string | null;
  operator_tag: string | null;
  operator_priority: string | null;
  operator_note_updated_at: Date | string | null;
};

type ConversationHeaderRow = {
  conversation_id: string;
  member_id: string | null;
  customer_id: string | null;
  channel: string | null;
  status: string | null;
  context_product_name: string | null;
  last_message_at: Date | string | null;
  last_customer_message_at: Date | string | null;
  last_operator_message_at: Date | string | null;
  operator_reviewed_at: Date | string | null;
  operator_reviewed_by: string | null;
  operator_review_note: string | null;
  operator_note: string | null;
  operator_tag: string | null;
  operator_priority: string | null;
  operator_note_updated_at: Date | string | null;
};

type ConversationMessageRow = {
  id: string;
  direction: "in" | "out" | null;
  sender_type: SenderType;
  msg_type: string | null;
  text_body: string | null;
  created_at: Date | string | null;
  raw: Record<string, unknown> | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getTenantPanelContextByMerchantId(merchantId: string): Promise<TenantPanelContext | null> {
  const rows = await prisma.$queryRaw<TenantContextRow[]>`
    select
      t.id as tenant_id,
      t.brand_name,
      t.wa_phone_number_id,
      max(p.attributes->>'store_name') as store_name,
      max(p.attributes->>'merchant_id') as merchant_id,
      max(p.attributes->>'source_platform') as source_platform
    from public.tenants t
    left join public.products p on p.tenant_id = t.id
    where p.attributes->>'merchant_id' = ${merchantId}
    group by t.id, t.brand_name, t.wa_phone_number_id
    order by t.created_at desc
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    tenantId: row.tenant_id,
    brandName: row.brand_name,
    waPhoneNumberId: row.wa_phone_number_id,
    storeName: row.store_name,
    merchantId: row.merchant_id,
    sourcePlatform: row.source_platform,
    channel: "whatsapp",
  };
}

async function getLatestSyncSummary(tenantId: string): Promise<LatestSyncSummary | null> {
  const rows = await prisma.$queryRaw<LatestSyncRow[]>`
    select status, finished_at, error_count
    from public.catalog_sync_runs
    where tenant_id = CAST(${tenantId} AS uuid)
    order by finished_at desc nulls last, started_at desc nulls last, created_at desc nulls last
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;
  return { status: row.status, finishedAt: toIso(row.finished_at), errorCount: toNumber(row.error_count) };
}

export async function getDashboardSummaryByMerchantId(merchantId: string): Promise<DashboardSummaryResponse> {
  try {
    const tenant = await getTenantPanelContextByMerchantId(merchantId);
    if (!tenant) return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, ikasConnected: false, productCount: 0, variantCount: 0, policyCount: 0, contactChannelCount: 0, latestSync: null, error: "Tenant not found for merchant" };

    const [productCountRows, variantCountRows, policyCountRows, contactCountRows, latestSync] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.products where tenant_id = CAST(${tenant.tenantId} AS uuid)`,
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.product_variants v inner join public.products p on p.id = v.product_id where p.tenant_id = CAST(${tenant.tenantId} AS uuid)`,
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.tenant_policies where tenant_id = CAST(${tenant.tenantId} AS uuid) and is_active = true`,
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.tenant_contact_channels where tenant_id = CAST(${tenant.tenantId} AS uuid) and is_active = true`,
      getLatestSyncSummary(tenant.tenantId),
    ]);

    return { ok: true, fetchedAt: new Date().toISOString(), tenant, ikasConnected: tenant.sourcePlatform === "ikas", productCount: toNumber(productCountRows[0]?.count), variantCount: toNumber(variantCountRows[0]?.count), policyCount: toNumber(policyCountRows[0]?.count), contactChannelCount: toNumber(contactCountRows[0]?.count), latestSync };
  } catch (error) {
    return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, ikasConnected: false, productCount: 0, variantCount: 0, policyCount: 0, contactChannelCount: 0, latestSync: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getCatalogHealthByMerchantId(merchantId: string): Promise<CatalogHealthResponse> {
  try {
    const tenant = await getTenantPanelContextByMerchantId(merchantId);
    if (!tenant) return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, productCountTotal: 0, productCountActive: 0, variantCountTotal: 0, variantCountInStock: 0, variantCountPriced: 0, latestSync: null, error: "Tenant not found for merchant" };

    const [productTotalRows, productActiveRows, variantTotalRows, variantInStockRows, variantPricedRows, latestSync] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.products where tenant_id = CAST(${tenant.tenantId} AS uuid)`,
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.products where tenant_id = CAST(${tenant.tenantId} AS uuid) and is_active = true`,
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.product_variants v inner join public.products p on p.id = v.product_id where p.tenant_id = CAST(${tenant.tenantId} AS uuid)`,
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.product_variants v inner join public.products p on p.id = v.product_id where p.tenant_id = CAST(${tenant.tenantId} AS uuid) and (v.stock_status = 'in_stock' or coalesce(v.stock_qty, 0) > 0)`,
      prisma.$queryRaw<CountRow[]>`select count(*)::int as count from public.product_variants v inner join public.products p on p.id = v.product_id where p.tenant_id = CAST(${tenant.tenantId} AS uuid) and v.price is not null`,
      getLatestSyncSummary(tenant.tenantId),
    ]);

    return { ok: true, fetchedAt: new Date().toISOString(), tenant, productCountTotal: toNumber(productTotalRows[0]?.count), productCountActive: toNumber(productActiveRows[0]?.count), variantCountTotal: toNumber(variantTotalRows[0]?.count), variantCountInStock: toNumber(variantInStockRows[0]?.count), variantCountPriced: toNumber(variantPricedRows[0]?.count), latestSync };
  } catch (error) {
    return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, productCountTotal: 0, productCountActive: 0, variantCountTotal: 0, variantCountInStock: 0, variantCountPriced: 0, latestSync: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getProductsListByMerchantId(merchantId: string): Promise<ProductsListResponse> {
  try {
    const tenant = await getTenantPanelContextByMerchantId(merchantId);
    if (!tenant) return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, items: [], error: "Tenant not found for merchant" };

    const rows = await prisma.$queryRaw<ProductRow[]>`
      select p.id, p.name, p.handle, p.category, p.subcategory, p.base_price, coalesce(p.base_price, min(v.price)) as display_price, p.currency, p.stock_status, p.is_active, p.short_description, p.attributes, count(v.id)::int as variant_count
      from public.products p
      left join public.product_variants v on v.product_id = p.id
      where p.tenant_id = CAST(${tenant.tenantId} AS uuid)
      group by p.id, p.name, p.handle, p.category, p.subcategory, p.base_price, p.currency, p.stock_status, p.is_active, p.short_description, p.attributes
      order by p.is_active desc, p.updated_at desc nulls last, p.created_at desc nulls last, p.name asc
      limit 50
    `;

    const items: ProductListItem[] = rows.map((row) => ({ id: row.id, name: row.name || "-", handle: row.handle, category: row.category, subcategory: row.subcategory, basePrice: toNullableNumber(row.display_price), currency: row.currency, stockStatus: row.stock_status, isActive: Boolean(row.is_active), shortDescription: row.short_description, variantCount: toNumber(row.variant_count), attributes: row.attributes || null }));
    return { ok: true, fetchedAt: new Date().toISOString(), tenant, items };
  } catch (error) {
    return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, items: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getVariantsListByMerchantId(merchantId: string): Promise<VariantsListResponse> {
  try {
    const tenant = await getTenantPanelContextByMerchantId(merchantId);
    if (!tenant) return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, items: [], error: "Tenant not found for merchant" };

    const rows = await prisma.$queryRaw<VariantRow[]>`
      select v.id, p.id as product_id, p.name as product_name, v.sku, v.title, v.color, v.size, v.price, v.stock_qty, v.stock_status, v.is_active
      from public.product_variants v
      inner join public.products p on p.id = v.product_id
      where p.tenant_id = CAST(${tenant.tenantId} AS uuid)
      order by p.name asc, coalesce(v.color, '') asc, coalesce(v.size, '') asc, v.title asc nulls last
      limit 200
    `;

    const items: VariantListItem[] = rows.map((row) => ({ id: row.id, productId: row.product_id, productName: row.product_name || "-", sku: row.sku, title: row.title, color: row.color, size: row.size, price: toNullableNumber(row.price), stockQty: toNumber(row.stock_qty), stockStatus: row.stock_status, isActive: Boolean(row.is_active) }));
    return { ok: true, fetchedAt: new Date().toISOString(), tenant, items };
  } catch (error) {
    return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, items: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getPoliciesContactByMerchantId(merchantId: string): Promise<PoliciesContactResponse> {
  try {
    const tenant = await getTenantPanelContextByMerchantId(merchantId);
    if (!tenant) return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, policies: { shipping: null, delivery: null, return: null, exchange: null, support: null, contact: null }, contactChannels: [], error: "Tenant not found for merchant" };

    const [policyRows, contactRows] = await Promise.all([
      prisma.$queryRaw<PolicyRow[]>`select policy_key, policy_text from public.tenant_policies where tenant_id = CAST(${tenant.tenantId} AS uuid) and is_active = true order by policy_key asc`,
      prisma.$queryRaw<ContactRow[]>`select id, channel_key, label, value, contact_url, availability_text, is_primary, is_active, priority from public.tenant_contact_channels where tenant_id = CAST(${tenant.tenantId} AS uuid) and is_active = true order by priority asc nulls last, created_at asc`,
    ]);

    const policies: PolicyMap = { shipping: null, delivery: null, return: null, exchange: null, support: null, contact: null };
    for (const row of policyRows) {
      if (row.policy_key === "shipping") policies.shipping = row.policy_text;
      if (row.policy_key === "delivery") policies.delivery = row.policy_text;
      if (row.policy_key === "return") policies.return = row.policy_text;
      if (row.policy_key === "exchange") policies.exchange = row.policy_text;
      if (row.policy_key === "support") policies.support = row.policy_text;
      if (row.policy_key === "contact") policies.contact = row.policy_text;
    }

    const contactChannels: ContactChannelItem[] = contactRows.map((row) => ({ id: row.id, channelKey: row.channel_key, label: row.label, value: row.value, displayValue: row.value, contactUrl: row.contact_url, availabilityText: row.availability_text, isPrimary: Boolean(row.is_primary), isActive: Boolean(row.is_active), priority: toNumber(row.priority) }));
    return { ok: true, fetchedAt: new Date().toISOString(), tenant, policies, contactChannels };
  } catch (error) {
    return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, policies: { shipping: null, delivery: null, return: null, exchange: null, support: null, contact: null }, contactChannels: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getInboxListByMerchantId(merchantId: string): Promise<InboxListResponse> {
  try {
    const tenant = await getTenantPanelContextByMerchantId(merchantId);
    if (!tenant) return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, items: [], error: "Tenant not found for merchant" };

    const rows = await prisma.$queryRaw<InboxConversationRow[]>`
      with latest_messages as (
        select distinct on (m.conversation_id)
          m.conversation_id,
          m.text_body as last_message_text,
          m.direction as last_message_direction,
          coalesce(m.sender_type, case when m.direction = 'in' then 'customer' else 'ai' end) as last_message_sender_type,
          m.created_at as last_message_at
        from public.messages m
        inner join public.conversations c on c.id = m.conversation_id
        where c.tenant_id = CAST(${tenant.tenantId} AS uuid)
        order by m.conversation_id, m.created_at desc nulls last
      ),
      conversation_sender_marks as (
        select
          m.conversation_id,
          max(m.created_at) filter (where coalesce(m.sender_type, case when m.direction = 'in' then 'customer' else 'ai' end) = 'customer') as last_customer_message_at,
          max(m.created_at) filter (where coalesce(m.sender_type, case when m.direction = 'in' then 'customer' else 'ai' end) = 'operator') as last_operator_message_at
        from public.messages m
        inner join public.conversations c on c.id = m.conversation_id
        where c.tenant_id = CAST(${tenant.tenantId} AS uuid)
        group by m.conversation_id
      )
      select
        c.id as conversation_id,
        c.member_id,
        tm.wa_user_id as customer_id,
        c.channel,
        c.status,
        c.context_product_name,
        coalesce(lm.last_message_at, c.last_message_at) as last_message_at,
        lm.last_message_text,
        lm.last_message_direction,
        lm.last_message_sender_type,
        csm.last_customer_message_at,
        csm.last_operator_message_at,
        c.operator_reviewed_at,
        c.operator_reviewed_by,
        c.operator_review_note,
        c.operator_note,
        c.operator_tag,
        c.operator_priority,
        c.operator_note_updated_at
      from public.conversations c
      left join public.tenant_members tm on tm.id = c.member_id
      left join latest_messages lm on lm.conversation_id = c.id
      left join conversation_sender_marks csm on csm.conversation_id = c.id
      where c.tenant_id = CAST(${tenant.tenantId} AS uuid)
      order by
        case
          when c.status = 'open'
           and csm.last_customer_message_at is not null
           and (csm.last_operator_message_at is null or csm.last_customer_message_at > csm.last_operator_message_at)
           and (c.operator_reviewed_at is null or csm.last_customer_message_at > c.operator_reviewed_at)
          then 1 else 0
        end desc,
        coalesce(lm.last_message_at, c.last_message_at) desc nulls last,
        c.created_at desc
      limit 100
    `;

    const items: InboxConversationItem[] = rows.map((row) => ({ id: row.conversation_id, memberId: row.member_id, customerId: row.customer_id, customerDisplay: row.customer_id || "Bilinmeyen müşteri", channel: row.channel, status: row.status, isOpen: row.status === "open", lastMessageText: row.last_message_text, lastMessageDirection: row.last_message_direction, lastMessageSenderType: row.last_message_sender_type, lastMessageAt: toIso(row.last_message_at), lastCustomerMessageAt: toIso(row.last_customer_message_at), lastOperatorMessageAt: toIso(row.last_operator_message_at), operatorReviewedAt: toIso(row.operator_reviewed_at), operatorReviewedBy: row.operator_reviewed_by, operatorReviewNote: row.operator_review_note, operatorNote: row.operator_note, operatorTag: row.operator_tag, operatorPriority: row.operator_priority, operatorNoteUpdatedAt: toIso(row.operator_note_updated_at), contextProductName: row.context_product_name }));
    return { ok: true, fetchedAt: new Date().toISOString(), tenant, items };
  } catch (error) {
    return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, items: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getConversationDetailByMerchantId(merchantId: string, conversationId: string): Promise<ConversationDetailResponse> {
  try {
    const tenant = await getTenantPanelContextByMerchantId(merchantId);
    if (!tenant) return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, conversation: null, error: "Tenant not found for merchant" };

    const headerRows = await prisma.$queryRaw<ConversationHeaderRow[]>`
      with conversation_sender_marks as (
        select
          m.conversation_id,
          max(m.created_at) filter (where coalesce(m.sender_type, case when m.direction = 'in' then 'customer' else 'ai' end) = 'customer') as last_customer_message_at,
          max(m.created_at) filter (where coalesce(m.sender_type, case when m.direction = 'in' then 'customer' else 'ai' end) = 'operator') as last_operator_message_at
        from public.messages m
        where m.conversation_id = CAST(${conversationId} AS uuid)
        group by m.conversation_id
      )
      select
        c.id as conversation_id,
        c.member_id,
        tm.wa_user_id as customer_id,
        c.channel,
        c.status,
        c.context_product_name,
        c.last_message_at,
        csm.last_customer_message_at,
        csm.last_operator_message_at,
        c.operator_reviewed_at,
        c.operator_reviewed_by,
        c.operator_review_note,
        c.operator_note,
        c.operator_tag,
        c.operator_priority,
        c.operator_note_updated_at
      from public.conversations c
      left join public.tenant_members tm on tm.id = c.member_id
      left join conversation_sender_marks csm on csm.conversation_id = c.id
      where c.tenant_id = CAST(${tenant.tenantId} AS uuid)
        and c.id = CAST(${conversationId} AS uuid)
      limit 1
    `;

    const header = headerRows[0];
    if (!header) return { ok: false, fetchedAt: new Date().toISOString(), tenant, conversation: null, error: "Conversation not found" };

    const messageRows = await prisma.$queryRaw<ConversationMessageRow[]>`
      select m.id, m.direction, coalesce(m.sender_type, case when m.direction = 'in' then 'customer' else 'ai' end) as sender_type, m.msg_type, m.text_body, m.created_at, m.raw
      from public.messages m
      where m.conversation_id = CAST(${conversationId} AS uuid)
      order by m.created_at asc nulls last, m.id asc
      limit 300
    `;

    const messages: ConversationMessageItem[] = messageRows.map((row) => {
      const rawString = JSON.stringify(row.raw || {});
      const msgType = row.msg_type || null;
      return { id: row.id, direction: row.direction, senderType: row.sender_type, msgType, textBody: row.text_body, createdAt: toIso(row.created_at), hasMediaLikePayload: msgType != null && msgType !== "text" && msgType !== "interactive" && rawString.length > 2 };
    });

    const conversation: ConversationDetailItem = { id: header.conversation_id, memberId: header.member_id, customerId: header.customer_id, customerDisplay: header.customer_id || "Bilinmeyen müşteri", channel: header.channel, status: header.status, isOpen: header.status === "open", lastMessageAt: toIso(header.last_message_at), lastCustomerMessageAt: toIso(header.last_customer_message_at), lastOperatorMessageAt: toIso(header.last_operator_message_at), operatorReviewedAt: toIso(header.operator_reviewed_at), operatorReviewedBy: header.operator_reviewed_by, operatorReviewNote: header.operator_review_note, operatorNote: header.operator_note, operatorTag: header.operator_tag, operatorPriority: header.operator_priority, operatorNoteUpdatedAt: toIso(header.operator_note_updated_at), contextProductName: header.context_product_name, messages };
    return { ok: true, fetchedAt: new Date().toISOString(), tenant, conversation };
  } catch (error) {
    return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, conversation: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
