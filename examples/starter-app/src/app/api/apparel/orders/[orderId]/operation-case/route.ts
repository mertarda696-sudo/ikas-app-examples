import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OrderOperationCaseBody = {
  caseType?: string;
  title?: string;
  description?: string;
  priority?: string;
  evidenceSummary?: string;
  evidenceState?: string;
};

type OrderCaseContextRow = {
  id: string;
  order_no: string;
  tenant_id: string;
  conversation_id: string | null;
  member_id: string | null;
  customer_wa_id: string | null;
};

type ConversationChannelRow = {
  channel: string | null;
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
  conversation_id: string | null;
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
  const normalized = String(value || "order_support").trim();
  return ALLOWED_CASE_TYPES.has(normalized) ? normalized : "order_support";
}

function normalizePriority(value: string | undefined) {
  const normalized = String(value || "normal").trim();
  return ALLOWED_PRIORITIES.has(normalized) ? normalized : "normal";
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
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

    const { orderId } = await params;
    const body = (await request.json().catch(() => ({}))) as OrderOperationCaseBody;

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

    const orderRows = await prisma.$queryRaw<OrderCaseContextRow[]>`
      select
        id,
        order_no,
        tenant_id,
        conversation_id,
        member_id,
        customer_wa_id
      from public.commerce_orders
      where tenant_id = CAST(${tenant.tenantId} AS uuid)
        and (
          id::text = ${orderId}
          or order_no = ${orderId}
        )
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      return NextResponse.json(
        {
          ok: false,
          error: "Order not found for merchant",
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
    const evidenceSummary = String(body.evidenceSummary || "").trim() || null;
    const evidenceState = String(body.evidenceState || "").trim() || null;

    const conversationRows = order.conversation_id
      ? await prisma.$queryRaw<ConversationChannelRow[]>`
          select channel
          from public.conversations
          where tenant_id = CAST(${tenant.tenantId} AS uuid)
            and id = CAST(${order.conversation_id} AS uuid)
          limit 1
        `
      : [];

    const sourceChannel = conversationRows[0]?.channel || "whatsapp";
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
        ${order.conversation_id ? order.conversation_id : null}::uuid,
        ${order.member_id ? order.member_id : null}::uuid,
        ${caseNo},
        ${caseType},
        ${title},
        ${description},
        ${priority},
        'open',
        ${sourceChannel},
        ${order.customer_wa_id},
        ${order.order_no},
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
        conversation_id,
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
          conversationId: row.conversation_id,
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
