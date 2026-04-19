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

  if (!row) {
    throw new Error("Conversation not found for merchant");
  }

  if (!row.customer_id) {
    throw new Error("Conversation customer wa_user_id not found");
  }

  if (!row.phone_number_id) {
    throw new Error("Tenant wa_phone_number_id not found");
  }

  return {
    conversationId: row.conversation_id,
    tenantId: row.tenant_id,
    toWaId: row.customer_id,
    phoneNumberId: row.phone_number_id,
  };
}

export async function sendOperatorReplyViaN8n(
  input: OperatorReplyWebhookInput,
): Promise<OperatorReplyWebhookResult> {
  const webhookUrl = process.env.N8N_PANEL_REPLY_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_PANEL_REPLY_WEBHOOK_SECRET;

  if (!webhookUrl) {
    throw new Error("N8N_PANEL_REPLY_WEBHOOK_URL is not configured");
  }

  if (!webhookSecret) {
    throw new Error("N8N_PANEL_REPLY_WEBHOOK_SECRET is not configured");
  }

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
