import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getInboxListByMerchantId } from "@/lib/apparel-panel/queries";

type CountRow = {
  count: number | string | null;
};

type CrmAlertRow = {
  crm_alert_conversation_count: number | string | null;
  risky_customer_count: number | string | null;
};

type PriorityCaseRow = {
  id: string;
  case_no: string | null;
  case_type: string | null;
  title: string | null;
  priority: string | null;
  status: string | null;
  customer_wa_id: string | null;
  linked_order_id: string | null;
  conversation_id: string | null;
  updated_at: Date | string | null;
  crm_tag: string | null;
  risk_level: string | null;
  followup_status: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value == null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isAfter(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return false;
  if (!b) return true;
  const at = new Date(a).getTime();
  const bt = new Date(b).getTime();
  return Number.isFinite(at) && Number.isFinite(bt) ? at > bt : false;
}

function needsOperatorReply(item: {
  status: string | null;
  lastCustomerMessageAt: string | null;
  lastOperatorMessageAt: string | null;
  lastAgentMessageAt?: string | null;
  operatorReviewedAt: string | null;
}) {
  const isOpen = String(item.status || "").toLowerCase() === "open";
  const latestAgentMessageAt = item.lastAgentMessageAt || item.lastOperatorMessageAt;
  const customerAfterAgent = isAfter(item.lastCustomerMessageAt, latestAgentMessageAt);
  const customerAfterReview = isAfter(item.lastCustomerMessageAt, item.operatorReviewedAt);

  return isOpen && customerAfterAgent && customerAfterReview;
}

function mapCaseTypeLabel(type: string | null | undefined) {
  if (type === "damaged_product") return "Hasarlı Ürün";
  if (type === "shipping_delivery") return "Kargo / Teslimat";
  if (type === "payment_proof") return "Ödeme / Dekont";
  if (type === "return_exchange") return "İade / Değişim";
  if (type === "size_consultation") return "Beden Danışma";
  if (type === "order_support") return "Sipariş Destek";
  if (type === "hot_lead") return "Sıcak Lead";
  return "Genel";
}

function mapCrmTagLabel(tag: string | null | undefined) {
  if (tag === "vip_customer") return "VIP müşteri";
  if (tag === "risky_customer") return "Riskli müşteri";
  if (tag === "high_return_tendency") return "İade eğilimi yüksek";
  if (tag === "needs_followup") return "Tekrar takip edilecek";
  if (tag === "delivery_issue") return "Problemli teslimat";
  if (tag === "hot_lead") return "Potansiyel sıcak lead";
  return "Genel müşteri";
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          metrics: null,
          priorityItems: [],
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const inboxResult = await getInboxListByMerchantId(user.merchantId);

    if (!inboxResult.ok || !inboxResult.tenant) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: inboxResult.tenant || null,
          metrics: null,
          priorityItems: [],
          error: inboxResult.error || "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const tenantId = inboxResult.tenant.tenantId;
    const inboxItems = inboxResult.items || [];

    const waitingReplyConversationCount = inboxItems.filter(needsOperatorReply).length;
    const openConversationCount = inboxItems.filter((item) => String(item.status || "").toLowerCase() === "open").length;
    const closedConversationCount = inboxItems.filter((item) => String(item.status || "").toLowerCase() === "closed").length;
    const productContextConversationCount = inboxItems.filter((item) => Boolean(item.contextProductName)).length;

    const [
      totalCaseRows,
      openCaseRows,
      highPriorityCaseRows,
      evidenceCaseRows,
      crmAlertRows,
      priorityCaseRows,
    ] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`
  select count(*)::int as count
  from public.operation_cases
  where tenant_id = CAST(${tenantId} AS uuid)
    and coalesce(is_test_record, false) = false
`,
      prisma.$queryRaw<CountRow[]>`
  select count(*)::int as count
  from public.operation_cases
  where tenant_id = CAST(${tenantId} AS uuid)
    and coalesce(is_test_record, false) = false
    and status in ('open', 'in_progress', 'waiting_customer')
`,
      prisma.$queryRaw<CountRow[]>`
  select count(*)::int as count
  from public.operation_cases
  where tenant_id = CAST(${tenantId} AS uuid)
    and coalesce(is_test_record, false) = false
    and status in ('open', 'in_progress', 'waiting_customer')
    and priority in ('high', 'critical')
`,
      prisma.$queryRaw<CountRow[]>`
  select count(*)::int as count
  from public.operation_cases
  where tenant_id = CAST(${tenantId} AS uuid)
    and coalesce(is_test_record, false) = false
    and (
      nullif(trim(coalesce(evidence_summary, '')), '') is not null
      or nullif(trim(coalesce(evidence_state, '')), '') is not null
      or nullif(trim(coalesce(description, '')), '') is not null
    )
`,
      prisma.$queryRaw<CrmAlertRow[]>`
        with crm_alert_customers as (
          select
            ccp.customer_wa_id
          from public.customer_crm_profiles ccp
          where ccp.tenant_id = CAST(${tenantId} AS uuid)
            and (
              ccp.risk_level in ('high', 'critical')
              or ccp.followup_status = 'operator_action_required'
              or ccp.crm_tag in ('risky_customer', 'high_return_tendency', 'needs_followup', 'delivery_issue', 'hot_lead')
            )
        ), conversation_customers as (
          select
            c.id as conversation_id,
            tm.wa_user_id as customer_wa_id
          from public.conversations c
          left join public.tenant_members tm
            on tm.id = c.member_id
          where c.tenant_id = CAST(${tenantId} AS uuid)
        )
        select
          count(distinct cc.conversation_id)::int as crm_alert_conversation_count,
          count(distinct cac.customer_wa_id)::int as risky_customer_count
        from crm_alert_customers cac
        left join conversation_customers cc
          on cc.customer_wa_id = cac.customer_wa_id
      `,
      prisma.$queryRaw<PriorityCaseRow[]>`
        select
          oc.id,
          oc.case_no,
          oc.case_type,
          oc.title,
          oc.priority,
          oc.status,
          oc.customer_wa_id,
          oc.linked_order_id,
          oc.conversation_id,
          oc.updated_at,
          coalesce(ccp.crm_tag, 'general') as crm_tag,
          coalesce(ccp.risk_level, 'normal') as risk_level,
          coalesce(ccp.followup_status, 'none') as followup_status
        from public.operation_cases oc
        left join public.customer_crm_profiles ccp
          on ccp.tenant_id = oc.tenant_id
         and ccp.customer_wa_id = oc.customer_wa_id
       where oc.tenant_id = CAST(${tenantId} AS uuid)
  and coalesce(oc.is_test_record, false) = false
  and oc.status in ('open', 'in_progress', 'waiting_customer')
  and (
    oc.priority in ('high', 'critical')
    or coalesce(ccp.risk_level, 'normal') in ('high', 'critical')
    or coalesce(ccp.followup_status, 'none') = 'operator_action_required'
  )
        order by
          case
            when oc.priority = 'critical' then 5
            when coalesce(ccp.risk_level, 'normal') = 'critical' then 4
            when oc.priority = 'high' then 3
            when coalesce(ccp.risk_level, 'normal') = 'high' then 2
            when coalesce(ccp.followup_status, 'none') = 'operator_action_required' then 1
            else 0
          end desc,
          oc.updated_at desc nulls last,
          oc.created_at desc nulls last
        limit 5
      `,
    ]);

    const crmAlertConversationCount = toNumber(crmAlertRows[0]?.crm_alert_conversation_count);
    const riskyCustomerCount = toNumber(crmAlertRows[0]?.risky_customer_count);

    const priorityItems = priorityCaseRows.map((row) => ({
      id: row.id,
      title: row.title || row.case_no || "Operasyon vakası",
      detail: `${mapCaseTypeLabel(row.case_type)} · ${row.customer_wa_id || "Müşteri bilinmiyor"}${row.risk_level === "high" || row.risk_level === "critical" ? ` · ${mapCrmTagLabel(row.crm_tag)}` : ""}`,
      href: `/operations/${row.id}`,
      cta: "Vaka Detayını Aç",
      priority: row.priority || "normal",
      status: row.status || "open",
      customerWaId: row.customer_wa_id,
      linkedOrderId: row.linked_order_id,
      conversationId: row.conversation_id,
      crmTag: row.crm_tag || "general",
      riskLevel: row.risk_level || "normal",
      followupStatus: row.followup_status || "none",
      updatedAt: toIso(row.updated_at),
    }));

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant: inboxResult.tenant,
testMode: {
  includeTestRecords: false,
},
metrics: {
          waitingReplyConversationCount,
          openConversationCount,
          closedConversationCount,
          productContextConversationCount,
          crmAlertConversationCount,
          riskyCustomerCount,
          totalOperationCaseCount: toNumber(totalCaseRows[0]?.count),
          openOperationCaseCount: toNumber(openCaseRows[0]?.count),
          highPriorityOperationCaseCount: toNumber(highPriorityCaseRows[0]?.count),
          evidenceOperationCaseCount: toNumber(evidenceCaseRows[0]?.count),
        },
        priorityItems,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        metrics: null,
        priorityItems: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
