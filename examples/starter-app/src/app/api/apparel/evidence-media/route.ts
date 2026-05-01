import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://wnougygablrqpfgoqzsm.supabase.co").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || "";
const DEFAULT_EVIDENCE_BUCKET = "case-evidence";

type EvidenceAttachmentRow = {
  id: string;
  message_id: string | null;
  kind: string | null;
  mime_type: string | null;
  file_name: string | null;
  storage_path: string | null;
  size_bytes: number | bigint | string | null;
  meta: unknown;
  created_at: Date | string | null;
  operation_case_id: string | null;
  case_no: string | null;
  case_type: string | null;
  case_title: string | null;
  case_status: string | null;
  case_priority: string | null;
  evidence_state: string | null;
  evidence_summary: string | null;
  linked_order_id: string | null;
  customer_wa_id: string | null;
  conversation_id: string | null;
};

type CountRow = {
  count: number | string | null;
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

function toMetricNumber(value: number | string | null | undefined) {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

async function mapEvidenceRow(row: EvidenceAttachmentRow) {
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
    customerWaId: row.customer_wa_id || getMetaString(meta, "customer_wa_id"),
    linkedOrderId: row.linked_order_id || getMetaString(meta, "linked_order_id"),
    caseNo: row.case_no || getMetaString(meta, "case_no"),
    caseType: row.case_type || getMetaString(meta, "case_type"),
    operationCaseId: row.operation_case_id || getMetaString(meta, "operation_case_id"),
    caseTitle: row.case_title,
    caseStatus: row.case_status,
    casePriority: row.case_priority,
    evidenceState: row.evidence_state,
    evidenceSummary: row.evidence_summary,
    conversationId: row.conversation_id || getMetaString(meta, "conversation_id"),
    captureStatus: getMetaString(meta, "capture_status"),
    signedUrl: signed.signedUrl,
    signedUrlError: signed.signedUrlError,
    createdAt: toIso(row.created_at),
  };
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
          metrics: { total: 0, stored: 0, metadataOnly: 0, images: 0, linkedCases: 0, damagedProduct: 0 },
          items: [],
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
          metrics: { total: 0, stored: 0, metadataOnly: 0, images: 0, linkedCases: 0, damagedProduct: 0 },
          items: [],
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const [rows, totalRows, storedRows, metadataOnlyRows, imageRows, linkedCaseRows, damagedRows] = await Promise.all([
      prisma.$queryRaw<EvidenceAttachmentRow[]>`
        select
          a.id,
          a.message_id,
          a.kind,
          a.mime_type,
          a.file_name,
          a.storage_path,
          a.size_bytes,
          a.meta,
          a.created_at,
          oc.id as operation_case_id,
          oc.case_no,
          oc.case_type,
          oc.title as case_title,
          oc.status as case_status,
          oc.priority as case_priority,
          oc.evidence_state,
          oc.evidence_summary,
          coalesce(oc.linked_order_id, a.meta->>'linked_order_id') as linked_order_id,
          coalesce(oc.customer_wa_id, a.meta->>'customer_wa_id') as customer_wa_id,
          coalesce(oc.conversation_id::text, a.meta->>'conversation_id') as conversation_id
        from public.attachments a
        left join public.operation_cases oc
          on oc.tenant_id = a.tenant_id
         and (
           oc.id::text = a.meta->>'operation_case_id'
           or (a.meta->>'case_no' is not null and oc.case_no = a.meta->>'case_no')
         )
        where a.tenant_id = CAST(${tenant.tenantId} AS uuid)
        order by a.created_at desc nulls last
        limit 100
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.attachments
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.attachments
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and coalesce(meta->>'capture_status', '') = 'stored'
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.attachments
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and coalesce(meta->>'capture_status', '') = 'metadata_only'
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.attachments
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and (kind = 'image' or mime_type like 'image/%')
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.attachments
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and nullif(trim(coalesce(meta->>'operation_case_id', meta->>'case_no', '')), '') is not null
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.attachments
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and coalesce(meta->>'case_type', '') = 'damaged_product'
      `,
    ]);

    const items = await Promise.all(rows.map(mapEvidenceRow));

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        metrics: {
          total: toMetricNumber(totalRows[0]?.count),
          stored: toMetricNumber(storedRows[0]?.count),
          metadataOnly: toMetricNumber(metadataOnlyRows[0]?.count),
          images: toMetricNumber(imageRows[0]?.count),
          linkedCases: toMetricNumber(linkedCaseRows[0]?.count),
          damagedProduct: toMetricNumber(damagedRows[0]?.count),
        },
        items,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        metrics: { total: 0, stored: 0, metadataOnly: 0, images: 0, linkedCases: 0, damagedProduct: 0 },
        items: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
