import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "./queries";

type ConversationSendContextRow = {
  conversation_id: string;
  tenant_id: string;
  customer_id: string | null;
  phone_number_id: string | null;
};

type OperatorReplyWebhookInput = {
  conversationId: string;
  tenantId: string;
  toWaId: string;
  phoneNumberId: string;
  merchantId: string;
  replyText: string;
};

type OperatorReplyWebhookResult = {
  ok: boolean;
  conversationId: string;
  externalMessageId: string | null;
  replyText: string;
  raw?: unknown;
};

type OperatorReviewRow = {
  conversation_id: string;
  operator_reviewed_at: Date | string | null;
  operator_reviewed_by: string | null;
  operator_review_note: string | null;
};

type ConversationStatusAction = "close" | "reopen";

type ConversationStatusRow = {
  conversation_id: string;
  status: string | null;
  closed_at: Date | string | null;
  close_reason: string | null;
  reopened_at: Date | string | null;
  reopened_from_status: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getConversationSendContextByMerchantId(
  merchantId: string,
  conversationId: string,
) {
  const tenant = await getTenantPanelContextByMerchantId(merchantId);

  if (!tenant) {
    throw new Error("Tenant not found for merchant");
  }

  const rows = await prisma.$queryRaw<ConversationSendContextRow[]>`
    select
      c.id as conversation_id,
      c.tenant_id as tenant_id,
      tm.wa_user_id as customer_id,
      t.wa_phone_number_id as phone_number_id
    from public.conversations c
    inner join public.tenants t
      on t.id = c.tenant_id
    left join public.tenant_members tm
      on tm.id = c.member_id
    where c.id = CAST(${conversationId} AS uuid)
      and c.tenant_id = CAST(${tenant.tenantId} AS uuid)
    limit 1
  `;

  const row = rows[0];

  if (!row) throw new Error("Conversation not found for merchant");
  if (!row.customer_id) throw new Error("Conversation customer wa_user_id not found");
  if (!row.phone_number_id) throw new Error("Tenant wa_phone_number_id not found");

  return {
    conversationId: row.conversation_id,
    tenantId: row.tenant_id,
    toWaId: row.customer_id,
    phoneNumberId: row.phone_number_id,
  };
}

export async function markConversationReviewedByMerchantId(
  merchantId: string,
  conversationId: string,
  note?: string,
) {
  const tenant = await getTenantPanelContextByMerchantId(merchantId);

  if (!tenant) {
    throw new Error("Tenant not found for merchant");
  }

  const normalizedNote = String(note || "").trim() || null;

  const rows = await prisma.$queryRaw<OperatorReviewRow[]>`
    update public.conversations
    set
      operator_reviewed_at = now(),
      operator_reviewed_by = ${merchantId},
      operator_review_note = ${normalizedNote}
    where id = CAST(${conversationId} AS uuid)
      and tenant_id = CAST(${tenant.tenantId} AS uuid)
    returning
      id as conversation_id,
      operator_reviewed_at,
      operator_reviewed_by,
      operator_review_note
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Conversation not found for merchant");
  }

  return {
    conversationId: row.conversation_id,
    operatorReviewedAt:
      row.operator_reviewed_at instanceof Date
        ? row.operator_reviewed_at.toISOString()
        : row.operator_reviewed_at,
    operatorReviewedBy: row.operator_reviewed_by,
    operatorReviewNote: row.operator_review_note,
  };
}

export async function updateConversationStatusByMerchantId(
  merchantId: string,
  conversationId: string,
  action: ConversationStatusAction,
) {
  const tenant = await getTenantPanelContextByMerchantId(merchantId);

  if (!tenant) {
    throw new Error("Tenant not found for merchant");
  }

  let rows: ConversationStatusRow[] = [];

  if (action === "close") {
    rows = await prisma.$queryRaw<ConversationStatusRow[]>`
      update public.conversations
      set
        status = 'closed',
        closed_at = now(),
        close_reason = 'operator_closed'
      where id = CAST(${conversationId} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
      returning
        id as conversation_id,
        status,
        closed_at,
        close_reason,
        reopened_at,
        reopened_from_status
    `;
  }

  if (action === "reopen") {
    rows = await prisma.$queryRaw<ConversationStatusRow[]>`
      update public.conversations
      set
        status = 'open',
        reopened_at = now(),
        reopened_from_status = coalesce(status, 'closed'),
        closed_at = null,
        close_reason = null
      where id = CAST(${conversationId} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
      returning
        id as conversation_id,
        status,
        closed_at,
        close_reason,
        reopened_at,
        reopened_from_status
    `;
  }

  const row = rows[0];

  if (!row) {
    throw new Error("Conversation not found for merchant");
  }

  return {
    conversationId: row.conversation_id,
    status: row.status,
    closedAt: toIso(row.closed_at),
    closeReason: row.close_reason,
    reopenedAt: toIso(row.reopened_at),
    reopenedFromStatus: row.reopened_from_status,
  };
}
export async function sendOperatorReplyViaN8n(
  input: OperatorReplyWebhookInput,
): Promise<OperatorReplyWebhookResult> {
  const webhookUrl = process.env.N8N_PANEL_REPLY_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_PANEL_REPLY_WEBHOOK_SECRET;

  if (!webhookUrl) throw new Error("N8N_PANEL_REPLY_WEBHOOK_URL is not configured");
  if (!webhookSecret) throw new Error("N8N_PANEL_REPLY_WEBHOOK_SECRET is not configured");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-panel-secret": webhookSecret,
    },
    body: JSON.stringify({
      conversation_id: input.conversationId,
      tenant_id: input.tenantId,
      to_wa_id: input.toWaId,
      phone_number_id: input.phoneNumberId,
      merchant_id: input.merchantId,
      reply_text: input.replyText,
    }),
    cache: "no-store",
  });

  const rawText = await response.text();

  let parsed: any = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = { ok: false, error: rawText || "Invalid JSON response from n8n" };
  }

  if (!response.ok || !parsed?.ok) {
    throw new Error(
      parsed?.error ||
        `n8n reply webhook failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  return {
    ok: true,
    conversationId: parsed?.conversation_id || input.conversationId,
    externalMessageId: parsed?.external_message_id || null,
    replyText: parsed?.reply_text || input.replyText,
    raw: parsed,
  };
}
