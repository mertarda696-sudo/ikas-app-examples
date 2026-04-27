import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OperationCaseEvidenceStateBody = {
  evidenceState?: string | null;
};

type OperationCaseEvidenceStateRow = {
  id: string;
  case_no: string | null;
  evidence_state: string | null;
  evidence_summary: string | null;
  updated_at: Date | string | null;
};

const ALLOWED_EVIDENCE_STATES = new Set([
  "requested",
  "received",
  "verified",
  "missing",
  "rejected",
]);

function normalizeEvidenceState(value: string | null | undefined) {
  const normalized = String(value || "").trim();

  if (ALLOWED_EVIDENCE_STATES.has(normalized)) {
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
    const body = (await request.json().catch(() => ({}))) as OperationCaseEvidenceStateBody;
    const evidenceState = normalizeEvidenceState(body.evidenceState);

    if (!evidenceState) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid evidence state",
          allowedEvidenceStates: Array.from(ALLOWED_EVIDENCE_STATES),
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

    const rows = await prisma.$queryRaw<OperationCaseEvidenceStateRow[]>`
      update public.operation_cases
      set
        evidence_state = ${evidenceState},
        updated_at = now()
      where id = CAST(${caseId} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
      returning
        id,
        case_no,
        evidence_state,
        evidence_summary,
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
