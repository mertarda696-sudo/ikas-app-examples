import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type MessageLinkReviewStatusBody = {
  reviewStatus?: string;
  reviewNote?: string;
};

type MessageLinkReviewStatusRow = {
  id: string;
  review_status: string;
  review_note: string | null;
  reviewed_at: Date | string | null;
  reviewed_by: string | null;
  updated_at: Date | string | null;
};

const ALLOWED_REVIEW_STATUSES = new Set([
  "open",
  "no_action_needed",
  "manual_review_needed",
  "manually_matched_product",
  "linked_to_case",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeReviewStatus(value: string | undefined) {
  const normalized = String(value || "").trim();

  if (ALLOWED_REVIEW_STATUSES.has(normalized)) {
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
  { params }: { params: Promise<{ linkId: string }> },
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

    const { linkId } = await params;

    if (!UUID_RE.test(linkId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid link id",
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as MessageLinkReviewStatusBody;
    const reviewStatus = normalizeReviewStatus(body.reviewStatus);

    if (!reviewStatus) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid review status",
          allowedReviewStatuses: Array.from(ALLOWED_REVIEW_STATUSES),
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

    const reviewNote = String(body.reviewNote || "").trim();

    const rows = await prisma.$queryRaw<MessageLinkReviewStatusRow[]>`
      update public.message_links
      set
        review_status = ${reviewStatus},
        review_note = case
          when nullif(trim(${reviewNote}), '') is not null then ${reviewNote}
          else review_note
        end,
        reviewed_at = now(),
        reviewed_by = ${user.merchantId},
        updated_at = now()
      where id = CAST(${linkId} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
      returning
        id,
        review_status,
        review_note,
        reviewed_at,
        reviewed_by,
        updated_at
    `;

    const row = rows[0];

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          error: "Message link not found for merchant",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        messageLink: {
          id: row.id,
          reviewStatus: row.review_status,
          reviewNote: row.review_note,
          reviewedAt: toIso(row.reviewed_at),
          reviewedBy: row.reviewed_by,
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
