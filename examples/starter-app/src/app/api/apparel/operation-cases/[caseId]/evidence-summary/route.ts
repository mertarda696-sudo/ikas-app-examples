import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OperationCaseEvidenceSummaryBody = {
  evidenceSummary?: string | null;
};

type OperationCaseEvidenceSummaryRow = {
  id: string;
  case_no: string | null;
  evidence_state: string | null;
  evidence_summary: string | null;
  updated_at: Date | string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEvidenceSummary(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized.slice(0, 1000) : null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function updateEvidenceSummaryByUuid(
  tenantId: string,
  caseId: string,
  evidenceSummary: string | null,
) {
  return prisma.$queryRaw<OperationCaseEvidenceSummaryRow[]>`
    update public.operation_cases
    set
      evidence_summary = ${evidenceSummary},
      updated_at = now()
    where id = CAST(${caseId} AS uuid)
      and tenant_id = CAST(${tenantId} AS uuid)
    returning
      id,
      case_no,
      evidence_state,
      evidence_summary,
      updated_at
  `;
}

async function updateEvidenceSummaryByCaseNo(
  tenantId: string,
  caseNo: string,
  evidenceSummary: string | null,
) {
  return prisma.$queryRaw<OperationCaseEvidenceSummaryRow[]>`
    update public.operation_cases
    set
      evidence_summary = ${evidenceSummary},
      updated_at = now()
    where case_no = ${caseNo}
      and tenant_id = CAST(${tenantId} AS uuid)
    returning
      id,
      case_no,
      evidence_state,
      evidence_summary,
      updated_at
  `;
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
    const normalizedCaseId = String(caseId || "").trim();
    const body = (await request.json().catch(() => ({}))) as OperationCaseEvidenceSummaryBody;
    const evidenceSummary = normalizeEvidenceSummary(body.evidenceSummary);

    if (!normalizedCaseId) {
      return NextResponse.json(
        {
          ok: false,
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
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const rows = UUID_RE.test(normalizedCaseId)
      ? await updateEvidenceSummaryByUuid(tenant.tenantId, normalizedCaseId, evidenceSummary)
      : await updateEvidenceSummaryByCaseNo(tenant.tenantId, normalizedCaseId, evidenceSummary);

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
          evidenceState: row.evidence_state,
          evidenceSummary: row.evidence_summary,
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
