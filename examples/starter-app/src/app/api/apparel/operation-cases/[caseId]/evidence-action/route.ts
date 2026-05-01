import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type EvidenceActionBody = {
  action?: string;
  note?: string;
};

type EvidenceActionRow = {
  id: string;
  case_no: string | null;
  status: string | null;
  evidence_state: string | null;
  evidence_summary: string | null;
  resolved_at: Date | string | null;
  closed_at: Date | string | null;
  updated_at: Date | string | null;
};

const ACTIONS = new Set([
  "verify_evidence",
  "request_more_evidence",
  "mark_evidence_insufficient",
  "start_review",
  "resolve_case",
]);

const ACTION_META: Record<string, { label: string }> = {
  verify_evidence: {
    label: "Kanıtı Doğrula",
  },
  request_more_evidence: {
    label: "Ek Kanıt İste",
  },
  mark_evidence_insufficient: {
    label: "Kanıt Yetersiz",
  },
  start_review: {
    label: "İncelemeye Al",
  },
  resolve_case: {
    label: "Çözüldü Yap",
  },
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeAction(value: string | undefined) {
  const action = String(value || "").trim();
  return ACTIONS.has(action) ? action : null;
}

function compactNote(value: unknown) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 700) : null;
}

function actionDefaults(action: string, note: string | null) {
  if (action === "verify_evidence") {
    return {
      status: "in_progress",
      evidenceState: "verified",
      summary: note || "Operatör medya kanıtını doğruladı.",
      resolved: false,
    };
  }

  if (action === "request_more_evidence") {
    return {
      status: "waiting_customer",
      evidenceState: "requested",
      summary: note || "Operatör müşteriden ek kanıt/fotoğraf talep etti.",
      resolved: false,
    };
  }

  if (action === "mark_evidence_insufficient") {
    return {
      status: "waiting_customer",
      evidenceState: "rejected",
      summary: note || "Operatör mevcut kanıtı yetersiz buldu; müşteriden ek kanıt bekleniyor.",
      resolved: false,
    };
  }

  if (action === "start_review") {
    return {
      status: "in_progress",
      evidenceState: null,
      summary: note || null,
      resolved: false,
    };
  }

  return {
    status: "resolved",
    evidenceState: "verified",
    summary: note || "Operatör vakayı kanıt incelemesi sonrası çözüldü olarak işaretledi.",
    resolved: true,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { caseId } = await params;
    const body = (await request.json().catch(() => ({}))) as EvidenceActionBody;
    const action = normalizeAction(body.action);
    const note = compactNote(body.note);

    if (!action) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid evidence action",
          allowedActions: Array.from(ACTIONS),
        },
        { status: 400 },
      );
    }

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json({ ok: false, error: "Tenant not found for merchant" }, { status: 404 });
    }

    const defaults = actionDefaults(action, note);

    const rows = await prisma.$queryRaw<EvidenceActionRow[]>`
      update public.operation_cases
      set
        status = ${defaults.status},
        evidence_state = coalesce(${defaults.evidenceState}, evidence_state),
        evidence_summary = coalesce(${defaults.summary}, evidence_summary),
        resolved_at = case
          when ${defaults.resolved} then coalesce(resolved_at, now())
          when ${defaults.status} in ('open', 'in_progress', 'waiting_customer') then null
          else resolved_at
        end,
        closed_at = case
          when ${defaults.status} in ('open', 'in_progress', 'waiting_customer', 'resolved') then null
          else closed_at
        end,
        updated_at = now()
      where id = CAST(${caseId} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
      returning
        id,
        case_no,
        status,
        evidence_state,
        evidence_summary,
        resolved_at,
        closed_at,
        updated_at
    `;

    const row = rows[0];

    if (!row) {
      return NextResponse.json({ ok: false, error: "Operation case not found for merchant" }, { status: 404 });
    }

    const actionMeta = ACTION_META[action] || { label: action };

await prisma.$executeRaw`
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
    CAST(${row.id} AS uuid),
    ${action},
    ${actionMeta.label},
    ${defaults.summary},
    'operator',
    ${String(user.merchantId || '')},
    'panel',
    CAST(${JSON.stringify({
      status: row.status,
      evidence_state: row.evidence_state,
      case_no: row.case_no,
    })} AS jsonb)
  )
`;

    return NextResponse.json(
      {
        ok: true,
        action,
        operationCase: {
          id: row.id,
          caseNo: row.case_no,
          status: row.status,
          evidenceState: row.evidence_state,
          evidenceSummary: row.evidence_summary,
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
