import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type CustomerCrmProfileBody = {
  crmTag?: string;
  riskLevel?: string;
  followupStatus?: string;
  internalNote?: string;
  metadata?: Record<string, unknown>;
};

type CustomerCrmProfileRow = {
  id: string;
  tenant_id: string;
  customer_wa_id: string;
  crm_tag: string;
  risk_level: string;
  followup_status: string;
  internal_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

const ALLOWED_CRM_TAGS = new Set([
  "general",
  "vip_customer",
  "risky_customer",
  "high_return_tendency",
  "needs_followup",
  "delivery_issue",
  "hot_lead",
]);

const ALLOWED_RISK_LEVELS = new Set(["low", "normal", "high", "critical"]);

const ALLOWED_FOLLOWUP_STATUSES = new Set([
  "none",
  "follow_up",
  "waiting_customer",
  "operator_action_required",
]);

function normalizeEnum(value: string | undefined, allowed: Set<string>, fallback: string) {
  const normalized = String(value || "").trim();
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapProfile(row: CustomerCrmProfileRow | null, customerWaId: string) {
  if (!row) {
    return {
      id: null,
      customerWaId,
      crmTag: "general",
      riskLevel: "normal",
      followupStatus: "none",
      internalNote: null,
      reviewedBy: null,
      reviewedAt: null,
      metadata: {},
      createdAt: null,
      updatedAt: null,
      exists: false,
    };
  }

  return {
    id: row.id,
    customerWaId: row.customer_wa_id,
    crmTag: row.crm_tag,
    riskLevel: row.risk_level,
    followupStatus: row.followup_status,
    internalNote: row.internal_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: toIso(row.reviewed_at),
    metadata: row.metadata || {},
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    exists: true,
  };
}

async function resolveTenant(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user?.merchantId) {
    return { user, tenant: null, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

  if (!tenant) {
    return { user, tenant: null, response: NextResponse.json({ ok: false, error: "Tenant not found for merchant" }, { status: 404 }) };
  }

  return { user, tenant, response: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerWaId: string }> },
) {
  try {
    const { user, tenant, response } = await resolveTenant(request);

    if (response || !tenant || !user?.merchantId) {
      return response;
    }

    const { customerWaId } = await params;
    const normalizedCustomerWaId = decodeURIComponent(customerWaId || "").trim();

    if (!normalizedCustomerWaId) {
      return NextResponse.json(
        {
          ok: false,
          error: "customerWaId is required",
        },
        { status: 400 },
      );
    }

    const rows = await prisma.$queryRaw<CustomerCrmProfileRow[]>`
      select
        id,
        tenant_id,
        customer_wa_id,
        crm_tag,
        risk_level,
        followup_status,
        internal_note,
        reviewed_by,
        reviewed_at,
        metadata,
        created_at,
        updated_at
      from public.customer_crm_profiles
      where tenant_id = CAST(${tenant.tenantId} AS uuid)
        and customer_wa_id = ${normalizedCustomerWaId}
      limit 1
    `;

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        profile: mapProfile(rows[0] || null, normalizedCustomerWaId),
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerWaId: string }> },
) {
  try {
    const { user, tenant, response } = await resolveTenant(request);

    if (response || !tenant || !user?.merchantId) {
      return response;
    }

    const { customerWaId } = await params;
    const normalizedCustomerWaId = decodeURIComponent(customerWaId || "").trim();

    if (!normalizedCustomerWaId) {
      return NextResponse.json(
        {
          ok: false,
          error: "customerWaId is required",
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as CustomerCrmProfileBody;

    const crmTag = normalizeEnum(body.crmTag, ALLOWED_CRM_TAGS, "general");
    const riskLevel = normalizeEnum(body.riskLevel, ALLOWED_RISK_LEVELS, "normal");
    const followupStatus = normalizeEnum(body.followupStatus, ALLOWED_FOLLOWUP_STATUSES, "none");
    const internalNote = normalizeOptionalText(body.internalNote);
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    const rows = await prisma.$queryRaw<CustomerCrmProfileRow[]>`
      insert into public.customer_crm_profiles (
        tenant_id,
        customer_wa_id,
        crm_tag,
        risk_level,
        followup_status,
        internal_note,
        reviewed_by,
        reviewed_at,
        metadata
      )
      values (
        CAST(${tenant.tenantId} AS uuid),
        ${normalizedCustomerWaId},
        ${crmTag},
        ${riskLevel},
        ${followupStatus},
        ${internalNote},
        ${user.merchantId},
        now(),
        CAST(${JSON.stringify(metadata)} AS jsonb)
      )
      on conflict (tenant_id, customer_wa_id)
      do update set
        crm_tag = excluded.crm_tag,
        risk_level = excluded.risk_level,
        followup_status = excluded.followup_status,
        internal_note = excluded.internal_note,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at,
        metadata = excluded.metadata,
        updated_at = now()
      returning
        id,
        tenant_id,
        customer_wa_id,
        crm_tag,
        risk_level,
        followup_status,
        internal_note,
        reviewed_by,
        reviewed_at,
        metadata,
        created_at,
        updated_at
    `;

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        profile: mapProfile(rows[0] || null, normalizedCustomerWaId),
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
