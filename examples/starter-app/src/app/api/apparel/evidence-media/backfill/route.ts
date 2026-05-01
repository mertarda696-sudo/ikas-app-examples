import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type AttachmentOwnershipRow = {
  id: string;
  tenant_id: string;
  storage_path: string | null;
  meta: unknown;
};

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

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found for merchant" },
        { status: 404 },
      );
    }

    const body = (await request.json().catch(() => null)) as { attachmentId?: string; attachment_id?: string } | null;
    const attachmentId = String(body?.attachmentId || body?.attachment_id || "").trim();

    if (!attachmentId) {
      return NextResponse.json(
        { ok: false, error: "attachment_id_required" },
        { status: 400 },
      );
    }

    const rows = await prisma.$queryRaw<AttachmentOwnershipRow[]>`
      select id, tenant_id::text as tenant_id, storage_path, meta
      from public.attachments
      where tenant_id = CAST(${tenant.tenantId} AS uuid)
        and id = CAST(${attachmentId} AS uuid)
      limit 1
    `;

    const attachment = rows[0] || null;

    if (!attachment) {
      return NextResponse.json(
        { ok: false, error: "attachment_not_found_for_tenant" },
        { status: 404 },
      );
    }

    const meta = toMetaObject(attachment.meta);
    const captureStatus = getMetaString(meta, "capture_status");
    const hasStoragePath = Boolean(attachment.storage_path || getMetaString(meta, "storage_path"));

    if (captureStatus === "stored" || hasStoragePath) {
      return NextResponse.json(
        {
          ok: true,
          status: "skipped",
          reason: "already_stored",
          attachment_id: attachmentId,
        },
        { status: 200 },
      );
    }

    const webhookUrl = String(process.env.MEDIA_BACKFILL_WEBHOOK_URL || "").trim();
    const webhookSecret = String(process.env.MEDIA_BACKFILL_SECRET || "").trim();

    if (!webhookUrl || !webhookSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_media_backfill_env",
          missing: {
            MEDIA_BACKFILL_WEBHOOK_URL: !webhookUrl,
            MEDIA_BACKFILL_SECRET: !webhookSecret,
          },
        },
        { status: 500 },
      );
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-backfill-secret": webhookSecret,
      },
      body: JSON.stringify({ attachment_id: attachmentId }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: payload?.error || payload?.message || `media_backfill_failed_${response.status}`,
          details: payload,
        },
        { status: response.ok ? 500 : response.status },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: payload.status || "stored",
        attachment_id: payload.attachment_id || attachmentId,
        storage_bucket: payload.storage_bucket || null,
        storage_path: payload.storage_path || null,
        file_name: payload.file_name || null,
        size_bytes: payload.size_bytes ?? null,
        reason: payload.reason || null,
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
