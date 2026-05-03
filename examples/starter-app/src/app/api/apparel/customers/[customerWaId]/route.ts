import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type MemberRow = {
  id: string;
  wa_user_id: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type ConversationRow = {
  id: string;
  channel: string | null;
  status: string | null;
  context_product_name: string | null;
  last_message_at: Date | string | null;
  last_customer_message_at: Date | string | null;
  last_operator_message_at: Date | string | null;
  created_at: Date | string | null;
};

type OrderRow = {
  id: string;
  order_no: string;
  status: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  total_amount: number | string | null;
  currency: string | null;
  conversation_id: string | null;
  ordered_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type CaseRow = {
  id: string;
  case_no: string | null;
  case_type: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  linked_order_id: string | null;
  conversation_id: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type LastMessageRow = {
  id: string;
  conversation_id: string | null;
  direction: string | null;
  sender_type: string | null;
  text_body: string | null;
  created_at: Date | string | null;
};

type SumRow = {
  amount: number | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerWaId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          customer: null,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { customerWaId } = await params;
    const normalizedCustomerWaId = decodeURIComponent(customerWaId || "").trim();

    if (!normalizedCustomerWaId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          customer: null,
          error: "customerWaId is required",
        },
        { status: 400 },
      );
    }

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          customer: null,
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const memberRows = await prisma.$queryRaw<MemberRow[]>`
      select
        id,
        wa_user_id,
        created_at,
        null::timestamptz as updated_at
      from public.tenant_members
      where tenant_id = CAST(${tenant.tenantId} AS uuid)
        and wa_user_id = ${normalizedCustomerWaId}
      order by created_at desc nulls last
      limit 1
    `;

    const member = memberRows[0] || null;

    const [conversationRows, orderRows, caseRows, lastMessageRows, revenueRows] = await Promise.all([
      prisma.$queryRaw<ConversationRow[]>`
        select
          id,
          channel,
          status,
          context_product_name,
          last_message_at,
          last_customer_message_at,
          last_agent_message_at as last_operator_message_at,
          created_at
        from public.conversations
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and (
            (${member?.id || null}::uuid is not null and member_id = ${member?.id || null}::uuid)
            or id in (
              select distinct conversation_id
              from public.commerce_orders
              where tenant_id = CAST(${tenant.tenantId} AS uuid)
                and customer_wa_id = ${normalizedCustomerWaId}
                and conversation_id is not null
            )
            or id in (
  select distinct conversation_id
  from public.operation_cases
  where tenant_id = CAST(${tenant.tenantId} AS uuid)
    and customer_wa_id = ${normalizedCustomerWaId}
    and conversation_id is not null
    and coalesce(is_test_record, false) = false
)
          )
        order by last_message_at desc nulls last, created_at desc nulls last
        limit 50
      `,
      prisma.$queryRaw<OrderRow[]>`
        select
          id,
          order_no,
          status,
          financial_status,
          fulfillment_status,
          total_amount,
          currency,
          conversation_id,
          ordered_at,
          created_at,
          updated_at
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and customer_wa_id = ${normalizedCustomerWaId}
        order by ordered_at desc nulls last, created_at desc nulls last
        limit 50
      `,
      prisma.$queryRaw<CaseRow[]>`
  select
    id,
    case_no,
    case_type,
    title,
    description,
    priority,
    status,
    linked_order_id,
    conversation_id,
    created_at,
    updated_at
  from public.operation_cases
  where tenant_id = CAST(${tenant.tenantId} AS uuid)
    and customer_wa_id = ${normalizedCustomerWaId}
    and coalesce(is_test_record, false) = false
  order by updated_at desc nulls last, created_at desc nulls last
  limit 50
`,
      prisma.$queryRaw<LastMessageRow[]>`
        select
          m.id,
          m.conversation_id,
          m.direction,
          null::text as sender_type,
          m.text_body,
          m.created_at
        from public.messages m
        where m.tenant_id = CAST(${tenant.tenantId} AS uuid)
          and m.conversation_id in (
            select c.id
            from public.conversations c
            where c.tenant_id = CAST(${tenant.tenantId} AS uuid)
              and (${member?.id || null}::uuid is not null and c.member_id = ${member?.id || null}::uuid)
          )
        order by m.created_at desc nulls last
        limit 10
      `,
      prisma.$queryRaw<SumRow[]>`
        select coalesce(sum(total_amount), 0) as amount
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and customer_wa_id = ${normalizedCustomerWaId}
          and financial_status in ('paid', 'partially_paid')
          and status not in ('canceled')
      `,
    ]);

    const openConversationCount = conversationRows.filter((item) => item.status === "open").length;
    const openCaseCount = caseRows.filter((item) => ["open", "in_progress", "waiting_customer"].includes(String(item.status || ""))).length;
    const paidOrderCount = orderRows.filter((item) => ["paid", "partially_paid"].includes(String(item.financial_status || ""))).length;

    const lastActivityAt = [
      ...conversationRows.map((item) => item.last_message_at || item.created_at),
      ...orderRows.map((item) => item.updated_at || item.ordered_at || item.created_at),
      ...caseRows.map((item) => item.updated_at || item.created_at),
      ...lastMessageRows.map((item) => item.created_at),
    ]
      .filter(Boolean)
      .map((value) => new Date(String(value)).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0];

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        customer: {
          waId: normalizedCustomerWaId,
          displayName: normalizedCustomerWaId,
          memberId: member?.id || null,
          memberCreatedAt: toIso(member?.created_at),
          memberUpdatedAt: toIso(member?.updated_at),
          metrics: {
            conversationCount: conversationRows.length,
            openConversationCount,
            orderCount: orderRows.length,
            paidOrderCount,
            operationCaseCount: caseRows.length,
            openCaseCount,
            totalRevenue: toNumber(revenueRows[0]?.amount),
          },
          lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
          conversations: conversationRows.map((item) => ({
            id: item.id,
            channel: item.channel,
            status: item.status,
            contextProductName: item.context_product_name,
            lastMessageAt: toIso(item.last_message_at),
            lastCustomerMessageAt: toIso(item.last_customer_message_at),
            lastOperatorMessageAt: toIso(item.last_operator_message_at),
            createdAt: toIso(item.created_at),
          })),
          orders: orderRows.map((item) => ({
            id: item.id,
            orderNo: item.order_no,
            status: item.status,
            financialStatus: item.financial_status,
            fulfillmentStatus: item.fulfillment_status,
            totalAmount: toNumber(item.total_amount),
            currency: item.currency,
            conversationId: item.conversation_id,
            orderedAt: toIso(item.ordered_at),
            createdAt: toIso(item.created_at),
            updatedAt: toIso(item.updated_at),
          })),
          operationCases: caseRows.map((item) => ({
            id: item.id,
            caseNo: item.case_no,
            caseType: item.case_type,
            title: item.title,
            description: item.description,
            priority: item.priority,
            status: item.status,
            linkedOrderId: item.linked_order_id,
            conversationId: item.conversation_id,
            createdAt: toIso(item.created_at),
            updatedAt: toIso(item.updated_at),
          })),
          lastMessages: lastMessageRows.map((item) => ({
            id: item.id,
            conversationId: item.conversation_id,
            direction: item.direction,
            senderType: item.sender_type,
            textBody: item.text_body,
            createdAt: toIso(item.created_at),
          })),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        customer: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
