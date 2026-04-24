import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OperationCaseStatusBody = {
  status?: string;
  note?: string;
};

type OperationCaseStatusRow = {
  id: string;
  case_no: string | null;
  status: string;
  priority: string | null;
  title: string | null;
  resolved_at: Date | string | null;
  closed_at: Date | string | null;
  updated_at: Date | string | null;
};

const ALLOWED_STATUSES = new Set([
  "open",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
]);

function normalizeStatus(value: string | undefined) {
  const normalized = String(value || "").trim();

  if (ALLOWED_STATUSES.has(normalized)) {
    return normalized;
  }

  return null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
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

    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as OperationCaseStatusBody;
    const status = normalizeStatus(body.status);

    if (!status) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid status",
          allowedStatuses: Array.from(ALLOWED_STATUSES),
        },
        { status: 400 },
      );
    }

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

    const rows = await prisma.$queryRaw<OperationCaseStatusRow[]>`
      update public.operation_cases
      set
        status = ${status},
        resolved_at = case
          when ${status} = 'resolved' then coalesce(resolved_at, now())
          when ${status} in ('open', 'in_progress', 'waiting_customer') then null
          else resolved_at
        end,
        closed_at = case
          when ${status} = 'closed' then coalesce(closed_at, now())
          when ${status} in ('open', 'in_progress', 'waiting_customer') then null
          else closed_at
        end,
        evidence_state = case
          when nullif(trim(${String(body.note || "")}), '') is not null then ${String(body.note || "").trim()}
          else evidence_state
        end,
        updated_at = now()
      where id = CAST(${caseId} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
      returning
        id,
        case_no,
        status,
        priority,
        title,
        resolved_at,
        closed_at,
        updated_at
    `;

    const row = rows[0];

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          error: "Operation case not found for merchant",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        case: {
          id: row.id,
          caseNo: row.case_no,
          status: row.status,
          priority: row.priority,
          title: row.title,
          resolvedAt: toIso(row.resolved_at),
          closedAt: toIso(row.closed_at),
          updatedAt: toIso(row.updated_at),
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
