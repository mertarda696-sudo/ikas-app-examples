import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OperationCaseBody = {
  caseType?: string;
  title?: string;
  description?: string;
  priority?: string;
  linkedOrderId?: string;
  evidenceSummary?: string;
  evidenceState?: string;
};

type ConversationCaseContextRow = {
  conversation_id: string;
  tenant_id: string;
  member_id: string | null;
  channel: string | null;
  customer_wa_id: string | null;
};

type OperationCaseRow = {
  id: string;
  case_no: string | null;
  case_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  source_channel: string | null;
  customer_wa_id: string | null;
  linked_order_id: string | null;
  evidence_summary: string | null;
  evidence_state: string | null;
  created_at: Date | string | null;
};

const ALLOWED_CASE_TYPES = new Set([
  "general",
  "return_exchange",
  "shipping_delivery",
  "size_consultation",
  "order_support",
  "payment_proof",
  "damaged_product",
  "hot_lead",
]);

const ALLOWED_PRIORITIES = new Set(["low", "normal", "high", "critical"]);

function normalizeCaseType(value: string | undefined) {
  const normalized = String(value || "general").trim();

  if (ALLOWED_CASE_TYPES.has(normalized)) {
    return normalized;
  }

  return "general";
}

function normalizePriority(value: string | undefined) {
  const normalized = String(value || "normal").trim();

  if (ALLOWED_PRIORITIES.has(normalized)) {
    return normalized;
  }

  return "normal";
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { conversationId } = await params;
    const body = (await request.json().catch(() => ({}))) as OperationCaseBody;

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const conversationRows = await prisma.$queryRaw<ConversationCaseContextRow[]>`
      select
        c.id as conversation_id,
        c.tenant_id as tenant_id,
        c.member_id,
        c.channel,
        tm.wa_user_id as customer_wa_id
      from public.conversations c
      left join public.tenant_members tm
        on tm.id = c.member_id
      where c.id = CAST(${conversationId} AS uuid)
        and c.tenant_id = CAST(${tenant.tenantId} AS uuid)
      limit 1
    `;

    const conversation = conversationRows[0];

    if (!conversation) {
      return NextResponse.json(
        {
          ok: false,
          error: "Conversation not found for merchant",
        },
        { status: 404 },
      );
    }

    const title = String(body.title || "").trim();

    if (!title) {
      return NextResponse.json(
        {
          ok: false,
          error: "Case title is required",
        },
        { status: 400 },
      );
    }

    const caseType = normalizeCaseType(body.caseType);
    const priority = normalizePriority(body.priority);

    const description = String(body.description || "").trim() || null;
    const linkedOrderId = String(body.linkedOrderId || "").trim() || null;
    const evidenceSummary = String(body.evidenceSummary || "").trim() || null;
    const evidenceState = String(body.evidenceState || "").trim() || null;

    const caseNo = `OP-${Date.now()}`;

    const rows = await prisma.$queryRaw<OperationCaseRow[]>`
      insert into public.operation_cases (
        tenant_id,
        conversation_id,
        member_id,
        case_no,
        case_type,
        title,
        description,
        priority,
        status,
        source_channel,
        customer_wa_id,
        linked_order_id,
        evidence_summary,
        evidence_state,
        created_by
      )
      values (
        CAST(${tenant.tenantId} AS uuid),
        CAST(${conversation.conversation_id} AS uuid),
        ${conversation.member_id ? conversation.member_id : null}::uuid,
        ${caseNo},
        ${caseType},
        ${title},
        ${description},
        ${priority},
        'open',
        ${conversation.channel || "whatsapp"},
        ${conversation.customer_wa_id},
        ${linkedOrderId},
        ${evidenceSummary},
        ${evidenceState},
        ${user.merchantId}
      )
      returning
        id,
        case_no,
        case_type,
        title,
        description,
        priority,
        status,
        source_channel,
        customer_wa_id,
        linked_order_id,
        evidence_summary,
        evidence_state,
        created_at
    `;

    const row = rows[0];

    return NextResponse.json(
      {
        ok: true,
        case: {
          id: row.id,
          caseNo: row.case_no,
          caseType: row.case_type,
          title: row.title,
          description: row.description,
          priority: row.priority,
          status: row.status,
          sourceChannel: row.source_channel,
          customerWaId: row.customer_wa_id,
          linkedOrderId: row.linked_order_id,
          evidenceSummary: row.evidence_summary,
          evidenceState: row.evidence_state,
          createdAt: toIso(row.created_at),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
