import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OperatorReplyBody = {
  message?: string;
};

type OperationCaseRow = {
  id: string;
  case_no: string | null;
  status: string | null;
  evidence_state: string | null;
  conversation_id: string | null;
  customer_wa_id: string | null;
  linked_order_id: string | null;
};

type OperationCaseEventRow = {
  id: string;
  event_type: string | null;
  event_label: string | null;
  event_note: string | null;
  actor_type: string | null;
  actor_id: string | null;
  source: string | null;
  payload: unknown;
  created_at: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeMessage(value: unknown) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 1200) : "";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as OperatorReplyBody;
    const message = normalizeMessage(body.message);

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "operator_reply_message_required" },
        { status: 400 },
      );
    }

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found for merchant" },
        { status: 404 },
      );
    }

    const caseRows = await prisma.$queryRaw<OperationCaseRow[]>`
      select
        id,
        case_no,
        status,
        evidence_state,
        conversation_id,
        customer_wa_id,
        linked_order_id
      from public.operation_cases
      where id = CAST(${caseId} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
      limit 1
    `;

    const operationCase = caseRows[0];

    if (!operationCase) {
      return NextResponse.json(
        { ok: false, error: "Operation case not found for merchant" },
        { status: 404 },
      );
    }

    if (!operationCase.customer_wa_id) {
      return NextResponse.json(
        { ok: false, error: "operation_case_customer_wa_id_missing" },
        { status: 400 },
      );
    }

    if (!operationCase.conversation_id) {
      return NextResponse.json(
        { ok: false, error: "operation_case_conversation_id_missing" },
        { status: 400 },
      );
    }

    const webhookUrl = String(process.env.PANEL_OPERATOR_REPLY_WEBHOOK_URL || "").trim();
    const webhookSecret = String(process.env.PANEL_OPERATOR_REPLY_SECRET || "").trim();

    if (!webhookUrl || !webhookSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_operator_reply_webhook_env",
          missing: {
            PANEL_OPERATOR_REPLY_WEBHOOK_URL: !webhookUrl,
            PANEL_OPERATOR_REPLY_SECRET: !webhookSecret,
          },
        },
        { status: 500 },
      );
    }

    const webhookPayload = {
      tenant_id: tenant.tenantId,
      operation_case_id: operationCase.id,
      case_no: operationCase.case_no,
      conversation_id: operationCase.conversation_id,
      customer_wa_id: operationCase.customer_wa_id,
      linked_order_id: operationCase.linked_order_id,
      message_text: message,
      actor_id: String(user.merchantId || ""),
      source: "operation_case_detail",
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-operator-reply-secret": webhookSecret,
      },
      body: JSON.stringify(webhookPayload),
      cache: "no-store",
    });

    const webhookResult = await webhookResponse.json().catch(() => null);

    if (!webhookResponse.ok || !webhookResult?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            webhookResult?.error ||
            webhookResult?.message ||
            `operator_reply_webhook_failed_${webhookResponse.status}`,
          details: webhookResult,
        },
        { status: webhookResponse.ok ? 500 : webhookResponse.status },
      );
    }

    await prisma.$executeRaw`
      update public.operation_cases
      set updated_at = now()
      where id = CAST(${operationCase.id} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
    `;

    const eventRows = await prisma.$queryRaw<OperationCaseEventRow[]>`
      insert into public.operation_case_events (
        tenant_id,
        operation_case_id,
        event_type,
        event_label,
        event_note,
        actor_type,
        actor_id,
        source,
        payload
      )
      values (
        CAST(${tenant.tenantId} AS uuid),
        CAST(${operationCase.id} AS uuid),
        'operator_reply',
        'Operatör Yanıtı',
        ${message},
        'operator',
        ${String(user.merchantId || '')},
        'panel',
        CAST(${JSON.stringify({
          case_no: operationCase.case_no,
          status: operationCase.status,
          evidence_state: operationCase.evidence_state,
          conversation_id: operationCase.conversation_id,
          customer_wa_id: operationCase.customer_wa_id,
          linked_order_id: operationCase.linked_order_id,
          webhook_result: webhookResult,
        })} AS jsonb)
      )
      returning
        id,
        event_type,
        event_label,
        event_note,
        actor_type,
        actor_id,
        source,
        payload,
        created_at
    `;

    const event = eventRows[0];

    return NextResponse.json(
      {
        ok: true,
        message: "Operator reply sent",
        webhookResult,
        event: {
          id: event.id,
          eventType: event.event_type,
          eventLabel: event.event_label,
          eventNote: event.event_note,
          actorType: event.actor_type,
          actorId: event.actor_id,
          source: event.source,
          payload: event.payload,
          createdAt: toIso(event.created_at),
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
