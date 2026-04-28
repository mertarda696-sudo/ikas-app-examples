import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type OperationCaseDetailRow = {
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
  resolved_at: Date | string | null;
  closed_at: Date | string | null;
  crm_profile_exists: boolean | null;
  crm_tag: string | null;
  risk_level: string | null;
  followup_status: string | null;
  crm_internal_note: string | null;
  crm_reviewed_at: Date | string | null;
  crm_updated_at: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

async function findCaseByUuid(tenantId: string, caseId: string) {
  return prisma.$queryRaw<OperationCaseDetailRow[]>`
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
      coalesce(oc.linked_order_id, co.order_no) as linked_order_id,
      oc.evidence_summary,
      oc.evidence_state,
      oc.assigned_to,
      oc.created_by,
      oc.conversation_id,
      oc.created_at,
      oc.updated_at,
      oc.resolved_at,
      oc.closed_at,
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
    left join public.commerce_orders co
      on co.tenant_id = oc.tenant_id
     and co.conversation_id = oc.conversation_id
    where oc.tenant_id = CAST(${tenantId} AS uuid)
      and oc.id = CAST(${caseId} AS uuid)
    order by co.updated_at desc nulls last, co.created_at desc nulls last
    limit 1
  `;
}

async function findCaseByCaseNo(tenantId: string, caseId: string) {
  return prisma.$queryRaw<OperationCaseDetailRow[]>`
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
      coalesce(oc.linked_order_id, co.order_no) as linked_order_id,
      oc.evidence_summary,
      oc.evidence_state,
      oc.assigned_to,
      oc.created_by,
      oc.conversation_id,
      oc.created_at,
      oc.updated_at,
      oc.resolved_at,
      oc.closed_at,
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
    left join public.commerce_orders co
      on co.tenant_id = oc.tenant_id
     and co.conversation_id = oc.conversation_id
    where oc.tenant_id = CAST(${tenantId} AS uuid)
      and oc.case_no = ${caseId}
    order by co.updated_at desc nulls last, co.created_at desc nulls last
    limit 1
  `;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          operationCase: null,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { caseId } = await params;
    const normalizedCaseId = String(caseId || "").trim();

    if (!normalizedCaseId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          operationCase: null,
          error: "caseId is required",
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
          operationCase: null,
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const rows = UUID_RE.test(normalizedCaseId)
      ? await findCaseByUuid(tenant.tenantId, normalizedCaseId)
      : await findCaseByCaseNo(tenant.tenantId, normalizedCaseId);

    const row = rows[0] || null;

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant,
          operationCase: null,
          error: "Operation case not found for merchant",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        operationCase: {
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
          resolvedAt: toIso(row.resolved_at),
          closedAt: toIso(row.closed_at),
          crmProfileExists: Boolean(row.crm_profile_exists),
          crmTag: row.crm_tag || "general",
          riskLevel: row.risk_level || "normal",
          followupStatus: row.followup_status || "none",
          crmInternalNote: row.crm_internal_note,
          crmReviewedAt: toIso(row.crm_reviewed_at),
          crmUpdatedAt: toIso(row.crm_updated_at),
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
        operationCase: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
