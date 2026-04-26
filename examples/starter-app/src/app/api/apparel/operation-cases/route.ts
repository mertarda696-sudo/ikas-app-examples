import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OperationCaseRow = {
  id: string;
  case_no: string | null;
  case_type: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  source_channel: string | null;
  customer_wa_id: string | null;
  linked_order_id: string | null;
  evidence_summary: string | null;
  evidence_state: string | null;
  assigned_to: string | null;
  created_by: string | null;
  conversation_id: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  crm_profile_exists: boolean | null;
  crm_tag: string | null;
  risk_level: string | null;
  followup_status: string | null;
  crm_internal_note: string | null;
  crm_reviewed_at: Date | string | null;
  crm_updated_at: Date | string | null;
};

type CountRow = {
  count: number | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: number | string | null | undefined) {
  if (value == null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function mapSourceChannelLabel(channel: string | null | undefined) {
  const normalized = String(channel || "").toLowerCase();

  if (normalized === "whatsapp") return "WhatsApp";
  if (normalized === "instagram") return "Instagram";
  if (normalized === "messenger") return "Messenger";
  if (normalized === "email") return "E-posta";
  if (normalized === "webchat") return "Web Chat";

  return channel || "Kanal bilgisi yok";
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
          items: [],
          metrics: {
            total: 0,
            open: 0,
            highPriority: 0,
            evidence: 0,
          },
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          items: [],
          metrics: {
            total: 0,
            open: 0,
            highPriority: 0,
            evidence: 0,
          },
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const [rows, totalRows, openRows, highPriorityRows, evidenceRows] = await Promise.all([
      prisma.$queryRaw<OperationCaseRow[]>`
        select
          oc.id,
          oc.case_no,
          oc.case_type,
          oc.title,
          oc.description,
          oc.priority,
          oc.status,
          oc.source_channel,
          oc.customer_wa_id,
          oc.linked_order_id,
          oc.evidence_summary,
          oc.evidence_state,
          oc.assigned_to,
          oc.created_by,
          oc.conversation_id,
          oc.created_at,
          oc.updated_at,
          (ccp.id is not null) as crm_profile_exists,
          coalesce(ccp.crm_tag, 'general') as crm_tag,
          coalesce(ccp.risk_level, 'normal') as risk_level,
          coalesce(ccp.followup_status, 'none') as followup_status,
          ccp.internal_note as crm_internal_note,
          ccp.reviewed_at as crm_reviewed_at,
          ccp.updated_at as crm_updated_at
        from public.operation_cases oc
        left join public.customer_crm_profiles ccp
          on ccp.tenant_id = oc.tenant_id
         and ccp.customer_wa_id = oc.customer_wa_id
        where oc.tenant_id = CAST(${tenant.tenantId} AS uuid)
        order by
          case
            when oc.priority = 'critical' then 4
            when oc.priority = 'high' then 3
            when oc.priority = 'normal' then 2
            when oc.priority = 'low' then 1
            else 0
          end desc,
          case
            when coalesce(ccp.risk_level, 'normal') = 'critical' then 4
            when coalesce(ccp.risk_level, 'normal') = 'high' then 3
            when coalesce(ccp.followup_status, 'none') = 'operator_action_required' then 2
            else 0
          end desc,
          oc.updated_at desc nulls last,
          oc.created_at desc nulls last
        limit 100
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.operation_cases
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.operation_cases
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and status in ('open', 'in_progress', 'waiting_customer')
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.operation_cases
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and priority in ('high', 'critical')
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.operation_cases
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and (
            nullif(trim(coalesce(evidence_summary, '')), '') is not null
            or nullif(trim(coalesce(evidence_state, '')), '') is not null
          )
      `,
    ]);

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        metrics: {
          total: toNumber(totalRows[0]?.count),
          open: toNumber(openRows[0]?.count),
          highPriority: toNumber(highPriorityRows[0]?.count),
          evidence: toNumber(evidenceRows[0]?.count),
        },
        items: rows.map((row) => ({
          id: row.id,
          caseNo: row.case_no,
          caseType: row.case_type,
          title: row.title,
          description: row.description,
          priority: row.priority,
          status: row.status,
          sourceChannel: mapSourceChannelLabel(row.source_channel),
          customerWaId: row.customer_wa_id,
          linkedOrderId: row.linked_order_id,
          evidenceSummary: row.evidence_summary,
          evidenceState: row.evidence_state,
          assignedTo: row.assigned_to,
          createdBy: row.created_by,
          conversationId: row.conversation_id,
          createdAt: toIso(row.created_at),
          updatedAt: toIso(row.updated_at),
          crmProfileExists: Boolean(row.crm_profile_exists),
          crmTag: row.crm_tag || "general",
          riskLevel: row.risk_level || "normal",
          followupStatus: row.followup_status || "none",
          crmInternalNote: row.crm_internal_note,
          crmReviewedAt: toIso(row.crm_reviewed_at),
          crmUpdatedAt: toIso(row.crm_updated_at),
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        items: [],
        metrics: {
          total: 0,
          open: 0,
          highPriority: 0,
          evidence: 0,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
