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
          assigned_to,
          created_by,
          conversation_id,
          created_at,
          updated_at
        from public.operation_cases
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
        order by
          case
            when priority = 'critical' then 4
            when priority = 'high' then 3
            when priority = 'normal' then 2
            when priority = 'low' then 1
            else 0
          end desc,
          updated_at desc nulls last,
          created_at desc nulls last
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
          sourceChannel: row.source_channel,
          customerWaId: row.customer_wa_id,
          linkedOrderId: row.linked_order_id,
          evidenceSummary: row.evidence_summary,
          evidenceState: row.evidence_state,
          assignedTo: row.assigned_to,
          createdBy: row.created_by,
          conversationId: row.conversation_id,
          createdAt: toIso(row.created_at),
          updatedAt: toIso(row.updated_at),
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
