import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  CatalogHealthResponse,
  ContactChannelItem,
  ConversationDetailItem,
  ConversationDetailResponse,
  ConversationMessageItem,
  ConversationMessageMediaAnalysisItem,
  ConversationMessageMediaItem,
  DashboardSummaryResponse,
  InboxConversationItem,
  InboxListResponse,
  LatestSyncSummary,
  MediaProductMatch,
  MediaProductMatchCandidate,
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
  last_agent_message_at: Date | string | null;
  operator_reviewed_at: Date | string | null;
  operator_reviewed_by: string | null;
  operator_review_note: string | null;
  operator_note: string | null;
  operator_tag: string | null;
  operator_priority: string | null;
  operator_note_updated_at: Date | string | null;
  ai_mode: string | null;
  ai_paused_at: Date | string | null;
  ai_paused_by: string | null;
  ai_pause_reason: string | null;
  ai_resume_reminder_at: Date | string | null;
  ai_resumed_at: Date | string | null;
  ai_resumed_by: string | null;
  ai_mode_updated_at: Date | string | null;
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
  last_agent_message_at: Date | string | null;
  operator_reviewed_at: Date | string | null;
  operator_reviewed_by: string | null;
  operator_review_note: string | null;
  operator_note: string | null;
  operator_tag: string | null;
  operator_priority: string | null;
  operator_note_updated_at: Date | string | null;
  ai_mode: string | null;
  ai_paused_at: Date | string | null;
  ai_paused_by: string | null;
  ai_pause_reason: string | null;
  ai_resume_reminder_at: Date | string | null;
  ai_resumed_at: Date | string | null;
  ai_resumed_by: string | null;
  ai_mode_updated_at: Date | string | null;
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

type ConversationMessageAttachmentRow = {
  id: string;
  message_id: string | null;
  kind: string | null;
  mime_type: string | null;
  file_name: string | null;
  storage_path: string | null;
  size_bytes: number | bigint | string | null;
  meta: unknown;
  created_at: Date | string | null;
};

type ConversationMessageAttachmentAnalysisRow = {
  id: string;
  attachment_id: string;
  analysis_status: string | null;
  analysis_type: string | null;
  media_type: string | null;
  detected_intent: string | null;
  detected_case_type: string | null;
  detected_customer_intent: string | null;
  summary_text: string | null;
  operator_note_suggestion: string | null;
  confidence: number | string | null;
  needs_operator_review: boolean | null;
  structured_json: unknown;
  updated_at: Date | string | null;
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

const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://wnougygablrqpfgoqzsm.supabase.co"
).replace(/\/$/, "");

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

const DEFAULT_EVIDENCE_BUCKET = "case-evidence";

function toBigNumber(value: number | bigint | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMetaObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getMetaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getStringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function getBooleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
}

function getNumberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function mapMediaProductMatchCandidate(value: unknown): MediaProductMatchCandidate {
  const row = toRecord(value);

  return {
    productId: getStringValue(row.product_id) || getStringValue(row.productId),
    productName: getStringValue(row.product_name) || getStringValue(row.productName),
    category: getStringValue(row.category),
    stockStatus: getStringValue(row.stock_status) || getStringValue(row.stockStatus),
    semanticScore: getNumberValue(row.semantic_score) ?? getNumberValue(row.semanticScore),
    stockScore: getNumberValue(row.stock_score) ?? getNumberValue(row.stockScore),
    matchConfidence: getNumberValue(row.match_confidence) ?? getNumberValue(row.matchConfidence),
    reasons: mapStringArray(row.reasons),
  };
}

function mapMediaProductMatch(value: unknown): MediaProductMatch | null {
  const row = toRecord(value);

  if (Object.keys(row).length === 0) return null;

  const candidatesRaw = Array.isArray(row.candidates) ? row.candidates : [];

  return {
    phase: getStringValue(row.phase),
    imageSummary: getStringValue(row.image_summary) || getStringValue(row.imageSummary),
    detectedColors: mapStringArray(row.detected_colors || row.detectedColors),
    detectedProductTypes: mapStringArray(row.detected_product_types || row.detectedProductTypes),
    productsSeenCount: getNumberValue(row.products_seen_count) ?? getNumberValue(row.productsSeenCount),
    candidatesCount: getNumberValue(row.candidates_count) ?? getNumberValue(row.candidatesCount),
    hasProductMatch: getBooleanValue(row.has_product_match ?? row.hasProductMatch, false),
    matchedProductId: getStringValue(row.matched_product_id) || getStringValue(row.matchedProductId),
    matchedProductName: getStringValue(row.matched_product_name) || getStringValue(row.matchedProductName),
    matchConfidence: getNumberValue(row.match_confidence) ?? getNumberValue(row.matchConfidence),
    shouldAutoReply: getBooleanValue(row.should_auto_reply ?? row.shouldAutoReply, false),
    needsOperatorReview: getBooleanValue(row.needs_operator_review ?? row.needsOperatorReview, true),
    suggestedReply: getStringValue(row.suggested_reply) || getStringValue(row.suggestedReply),
    candidates: candidatesRaw.map(mapMediaProductMatchCandidate),
  };
}

function mapConversationAttachmentAnalysisRow(
  row: ConversationMessageAttachmentAnalysisRow,
): ConversationMessageMediaAnalysisItem {
  const structuredJson = toRecord(row.structured_json);
  const mediaProductMatch = mapMediaProductMatch(structuredJson.media_product_match);

  return {
    id: row.id,
    analysisStatus: row.analysis_status,
    analysisType: row.analysis_type,
    mediaType: row.media_type,
    detectedIntent: row.detected_intent,
    detectedCaseType: row.detected_case_type,
    detectedCustomerIntent: row.detected_customer_intent,
    summaryText: row.summary_text,
    operatorNoteSuggestion: row.operator_note_suggestion,
    confidence: getNumberValue(row.confidence),
    needsOperatorReview: row.needs_operator_review,
    mediaProductMatch,
    updatedAt: toIso(row.updated_at),
  };
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeSignedUrl(raw: string | null) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/storage/v1")) return `${SUPABASE_URL}${raw}`;
  if (raw.startsWith("/")) return `${SUPABASE_URL}/storage/v1${raw}`;
  return `${SUPABASE_URL}/storage/v1/${raw}`;
}

async function createStorageSignedUrl(bucket: string, storagePath: string | null) {
  const safeBucket = String(bucket || DEFAULT_EVIDENCE_BUCKET).trim();
  const safePath = String(storagePath || "").trim();

  if (!safePath) {
    return { signedUrl: null as string | null, signedUrlError: null as string | null };
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return {
      signedUrl: null as string | null,
      signedUrlError: "missing_supabase_service_role_key",
    };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(safeBucket)}/${encodeStoragePath(safePath)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 60 * 30 }),
        cache: "no-store",
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      signedURL?: string;
      signedUrl?: string;
      url?: string;
      message?: string;
      error?: string;
    } | null;

    if (!response.ok) {
      return {
        signedUrl: null as string | null,
        signedUrlError:
          payload?.message || payload?.error || `storage_sign_failed_${response.status}`,
      };
    }

    const rawSignedUrl = payload?.signedURL || payload?.signedUrl || payload?.url || null;

    return {
      signedUrl: normalizeSignedUrl(rawSignedUrl),
      signedUrlError: null as string | null,
    };
  } catch (error) {
    return {
      signedUrl: null as string | null,
      signedUrlError: error instanceof Error ? error.message : "storage_sign_unknown_error",
    };
  }
}

async function getLatestAttachmentAnalysisByAttachmentIds(
  attachmentIds: string[],
): Promise<Map<string, ConversationMessageAttachmentAnalysisRow>> {
  const uniqueAttachmentIds = Array.from(
    new Set(
      attachmentIds
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  );

  const analysisByAttachmentId = new Map<string, ConversationMessageAttachmentAnalysisRow>();

  if (uniqueAttachmentIds.length === 0) {
    return analysisByAttachmentId;
  }

  const rows = await prisma.$queryRaw<ConversationMessageAttachmentAnalysisRow[]>`
    select distinct on (aa.attachment_id)
      aa.id,
      aa.attachment_id,
      aa.analysis_status,
      aa.analysis_type,
      aa.media_type,
      aa.detected_intent,
      aa.detected_case_type,
      aa.detected_customer_intent,
      aa.summary_text,
      aa.operator_note_suggestion,
      aa.confidence,
      aa.needs_operator_review,
      aa.structured_json,
      aa.updated_at
    from public.attachment_analysis aa
    where aa.attachment_id::text in (${Prisma.join(uniqueAttachmentIds)})
    order by aa.attachment_id, aa.updated_at desc nulls last, aa.created_at desc nulls last
  `;

  for (const row of rows) {
    analysisByAttachmentId.set(row.attachment_id, row);
  }

  return analysisByAttachmentId;
}

async function mapConversationAttachmentRow(
  row: ConversationMessageAttachmentRow,
  analysisRow: ConversationMessageAttachmentAnalysisRow | null,
): Promise<ConversationMessageMediaItem> {
  const meta = toMetaObject(row.meta);
  const storageBucket = getMetaString(meta, "storage_bucket") || DEFAULT_EVIDENCE_BUCKET;
  const storagePath = row.storage_path || getMetaString(meta, "storage_path");
  const signed = await createStorageSignedUrl(storageBucket, storagePath);

  return {
    id: row.id,
    messageId: row.message_id,
    kind: row.kind,
    mimeType: row.mime_type,
    fileName: row.file_name,
    storagePath,
    storageBucket,
    sizeBytes: toBigNumber(row.size_bytes),
    captureStatus: getMetaString(meta, "capture_status"),
    signedUrl: signed.signedUrl,
    signedUrlError: signed.signedUrlError,
    createdAt: toIso(row.created_at),
    analysis: analysisRow ? mapConversationAttachmentAnalysisRow(analysisRow) : null,
  };
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
        c.last_agent_message_at,
        c.operator_reviewed_at,
        c.operator_reviewed_by,
        c.operator_review_note,
        c.operator_note,
        c.operator_tag,
        c.operator_priority,
        c.operator_note_updated_at,
        c.ai_mode,
        c.ai_paused_at,
        c.ai_paused_by,
        c.ai_pause_reason,
        c.ai_resume_reminder_at,
        c.ai_resumed_at,
        c.ai_resumed_by,
        c.ai_mode_updated_at
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

       const items: InboxConversationItem[] = rows.map((row) => ({
      id: row.conversation_id,
      memberId: row.member_id,
      customerId: row.customer_id,
      customerDisplay: row.customer_id || "Bilinmeyen müşteri",
      channel: row.channel,
      status: row.status,
      isOpen: row.status === "open",
      lastMessageText: row.last_message_text,
      lastMessageDirection: row.last_message_direction,
      lastMessageSenderType: row.last_message_sender_type,
      lastMessageAt: toIso(row.last_message_at),
      lastCustomerMessageAt: toIso(row.last_customer_message_at),
      lastOperatorMessageAt: toIso(row.last_operator_message_at),
      lastAgentMessageAt: toIso(row.last_agent_message_at),
      operatorReviewedAt: toIso(row.operator_reviewed_at),
      operatorReviewedBy: row.operator_reviewed_by,
      operatorReviewNote: row.operator_review_note,
      operatorNote: row.operator_note,
      operatorTag: row.operator_tag,
      operatorPriority: row.operator_priority,
      operatorNoteUpdatedAt: toIso(row.operator_note_updated_at),
      aiMode: row.ai_mode,
      aiPausedAt: toIso(row.ai_paused_at),
      aiPausedBy: row.ai_paused_by,
      aiPauseReason: row.ai_pause_reason,
      aiResumeReminderAt: toIso(row.ai_resume_reminder_at),
      aiResumedAt: toIso(row.ai_resumed_at),
      aiResumedBy: row.ai_resumed_by,
      aiModeUpdatedAt: toIso(row.ai_mode_updated_at),
      contextProductName: row.context_product_name,
    }));
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
        c.last_agent_message_at,
        c.operator_reviewed_at,
        c.operator_reviewed_by,
        c.operator_review_note,
        c.operator_note,
        c.operator_tag,
        c.operator_priority,
        c.operator_note_updated_at,
        c.ai_mode,
        c.ai_paused_at,
        c.ai_paused_by,
        c.ai_pause_reason,
        c.ai_resume_reminder_at,
        c.ai_resumed_at,
        c.ai_resumed_by,
        c.ai_mode_updated_at
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

        const attachmentRows = await prisma.$queryRaw<ConversationMessageAttachmentRow[]>`
      select
        a.id,
        a.message_id,
        a.kind,
        a.mime_type,
        a.file_name,
        a.storage_path,
        a.size_bytes,
        a.meta,
        a.created_at
      from public.attachments a
      where a.tenant_id = CAST(${tenant.tenantId} AS uuid)
        and a.message_id in (
          select m.id
          from public.messages m
          where m.conversation_id = CAST(${conversationId} AS uuid)
        )
      order by a.created_at asc nulls last, a.id asc
    `;

    const analysisByAttachmentId = await getLatestAttachmentAnalysisByAttachmentIds(
  attachmentRows.map((row) => row.id),
);

const mappedAttachments = await Promise.all(
  attachmentRows.map((row) =>
    mapConversationAttachmentRow(
      row,
      analysisByAttachmentId.get(row.id) || null,
    ),
  ),
);

    const attachmentsByMessageId = new Map<string, ConversationMessageMediaItem[]>();

    for (const attachment of mappedAttachments) {
      if (!attachment.messageId) continue;

      const current = attachmentsByMessageId.get(attachment.messageId) || [];
      current.push(attachment);
      attachmentsByMessageId.set(attachment.messageId, current);
    }

        const messages: ConversationMessageItem[] = messageRows.map((row) => {
      const rawString = JSON.stringify(row.raw || {});
      const msgType = row.msg_type || null;
      const media = attachmentsByMessageId.get(row.id) || [];

      return {
        id: row.id,
        direction: row.direction,
        senderType: row.sender_type,
        msgType,
        textBody: row.text_body,
        createdAt: toIso(row.created_at),
        hasMediaLikePayload:
          media.length > 0 ||
          (msgType != null &&
            msgType !== "text" &&
            msgType !== "interactive" &&
            rawString.length > 2),
        media,
      };
    });

    const conversation: ConversationDetailItem = {
      id: header.conversation_id,
      memberId: header.member_id,
      customerId: header.customer_id,
      customerDisplay: header.customer_id || "Bilinmeyen müşteri",
      channel: header.channel,
      status: header.status,
      isOpen: header.status === "open",
      lastMessageAt: toIso(header.last_message_at),
      lastCustomerMessageAt: toIso(header.last_customer_message_at),
      lastOperatorMessageAt: toIso(header.last_operator_message_at),
      lastAgentMessageAt: toIso(header.last_agent_message_at),
      operatorReviewedAt: toIso(header.operator_reviewed_at),
      operatorReviewedBy: header.operator_reviewed_by,
      operatorReviewNote: header.operator_review_note,
      operatorNote: header.operator_note,
      operatorTag: header.operator_tag,
      operatorPriority: header.operator_priority,
      operatorNoteUpdatedAt: toIso(header.operator_note_updated_at),
      aiMode: header.ai_mode,
      aiPausedAt: toIso(header.ai_paused_at),
      aiPausedBy: header.ai_paused_by,
      aiPauseReason: header.ai_pause_reason,
      aiResumeReminderAt: toIso(header.ai_resume_reminder_at),
      aiResumedAt: toIso(header.ai_resumed_at),
      aiResumedBy: header.ai_resumed_by,
      aiModeUpdatedAt: toIso(header.ai_mode_updated_at),
      contextProductName: header.context_product_name,
      messages,
    };
    return { ok: true, fetchedAt: new Date().toISOString(), tenant, conversation };
  } catch (error) {
    return { ok: false, fetchedAt: new Date().toISOString(), tenant: null, conversation: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
