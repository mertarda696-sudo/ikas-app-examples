import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://wnougygablrqpfgoqzsm.supabase.co").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || "";
const DEFAULT_EVIDENCE_BUCKET = "case-evidence";

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

type OperationCaseAttachmentRow = {
  id: string;
  message_id: string | null;
  kind: string | null;
  mime_type: string | null;
  file_name: string | null;
  storage_path: string | null;
  size_bytes: number | bigint | string | null;
  meta: unknown;
  created_at: Date | string | null;
};

type OperationCaseEventRow = {
  id: string;
  event_type: string | null;
  event_label: string | null;
  event_note: string | null;
  actor_type: string | null;
  actor_id: string | null;
  source: string | null;
  payload: unknown;
  created_at: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: number | bigint | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMetaObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getMetaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeSignedUrl(raw: string | null) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/storage/v1")) return `${SUPABASE_URL}${raw}`;
  if (raw.startsWith("/")) return `${SUPABASE_URL}/storage/v1${raw}`;
  return `${SUPABASE_URL}/storage/v1/${raw}`;
}

async function createStorageSignedUrl(bucket: string, storagePath: string | null) {
  const safeBucket = String(bucket || DEFAULT_EVIDENCE_BUCKET).trim();
  const safePath = String(storagePath || "").trim();

  if (!safePath) {
    return { signedUrl: null as string | null, signedUrlError: null as string | null };
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return { signedUrl: null as string | null, signedUrlError: "missing_supabase_service_role_key" };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(safeBucket)}/${encodeStoragePath(safePath)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 * 30 }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as { signedURL?: string; signedUrl?: string; url?: string; message?: string; error?: string } | null;

    if (!response.ok) {
      return {
        signedUrl: null as string | null,
        signedUrlError: payload?.message || payload?.error || `storage_sign_failed_${response.status}`,
      };
    }

    const rawSignedUrl = payload?.signedURL || payload?.signedUrl || payload?.url || null;
    return { signedUrl: normalizeSignedUrl(rawSignedUrl), signedUrlError: null as string | null };
  } catch (error) {
    return {
      signedUrl: null as string | null,
      signedUrlError: error instanceof Error ? error.message : "storage_sign_unknown_error",
    };
  }
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

async function mapAttachmentRow(row: OperationCaseAttachmentRow) {
  const meta = toMetaObject(row.meta);
  const storageBucket = getMetaString(meta, "storage_bucket") || DEFAULT_EVIDENCE_BUCKET;
  const storagePath = row.storage_path || getMetaString(meta, "storage_path");
  const signed = await createStorageSignedUrl(storageBucket, storagePath);

  return {
    id: row.id,
    messageId: row.message_id,
    kind: row.kind,
    mimeType: row.mime_type,
    fileName: row.file_name,
    storagePath,
    storageBucket,
    sizeBytes: toNumber(row.size_bytes),
    whatsappMediaId: getMetaString(meta, "whatsapp_media_id"),
    mediaSha256: getMetaString(meta, "media_sha256"),
    externalMessageId: getMetaString(meta, "external_message_id"),
    caption: getMetaString(meta, "caption"),
    customerWaId: getMetaString(meta, "customer_wa_id"),
    linkedOrderId: getMetaString(meta, "linked_order_id"),
    caseNo: getMetaString(meta, "case_no"),
    caseType: getMetaString(meta, "case_type"),
    captureStatus: getMetaString(meta, "capture_status"),
    signedUrl: signed.signedUrl,
    signedUrlError: signed.signedUrlError,
    createdAt: toIso(row.created_at),
  };
}

function mapEventRow(row: OperationCaseEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    eventLabel: row.event_label,
    eventNote: row.event_note,
    actorType: row.actor_type,
    actorId: row.actor_id,
    source: row.source,
    payload: toMetaObject(row.payload),
    createdAt: toIso(row.created_at),
  };
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

async function findCaseByAnyId(tenantId: string, caseId: string) {
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
      and (
        oc.id::text = ${caseId}
        or oc.case_no = ${caseId}
      )
    order by co.updated_at desc nulls last, co.created_at desc nulls last
    limit 1
  `;
}

async function findAttachmentsForCase(tenantId: string, operationCaseId: string, caseNo: string | null) {
  const caseNoValue = String(caseNo || "").trim();

  return prisma.$queryRaw<OperationCaseAttachmentRow[]>`
    select
      id,
      message_id,
      kind,
      mime_type,
      file_name,
      storage_path,
      size_bytes,
      meta,
      created_at
    from public.attachments
    where tenant_id = CAST(${tenantId} AS uuid)
      and (
        meta->>'operation_case_id' = ${operationCaseId}
        or (${caseNoValue} <> '' and meta->>'case_no' = ${caseNoValue})
      )
    order by created_at desc nulls last
    limit 50
  `;
}

async function findEventsForCase(tenantId: string, operationCaseId: string) {
  return prisma.$queryRaw<OperationCaseEventRow[]>`
    select
      id,
      event_type,
      event_label,
      event_note,
      actor_type,
      actor_id,
      source,
      payload,
      created_at
    from public.operation_case_events
    where tenant_id = CAST(${tenantId} AS uuid)
      and operation_case_id = CAST(${operationCaseId} AS uuid)
    order by created_at desc
    limit 50
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

    const rows = await findCaseByAnyId(tenant.tenantId, normalizedCaseId);

    const row = rows[0] || null;

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant,
          operationCase: null,
          error: `Operation case not found for merchant | caseId=${normalizedCaseId} | tenantId=${tenant.tenantId}`,
        },
        { status: 404 },
      );
    }

    const attachmentRows = await findAttachmentsForCase(tenant.tenantId, row.id, row.case_no);
    const attachments = await Promise.all(attachmentRows.map(mapAttachmentRow));
    const eventRows = await findEventsForCase(tenant.tenantId, row.id);
    const events = eventRows.map(mapEventRow);

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
          attachments,
          events,
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
