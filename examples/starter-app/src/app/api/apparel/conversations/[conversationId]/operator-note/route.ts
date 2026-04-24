import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OperatorNoteBody = {
  note?: string;
  tag?: string;
  priority?: string;
};

type OperatorNoteRow = {
  conversation_id: string;
  operator_note: string | null;
  operator_tag: string | null;
  operator_priority: string | null;
  operator_note_updated_at: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { conversationId } = await params;
    const body = (await request.json().catch(() => ({}))) as OperatorNoteBody;

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found for merchant" },
        { status: 404 },
      );
    }

    const normalizedNote = String(body.note || "").trim() || null;
    const normalizedTag = String(body.tag || "").trim() || null;
    const normalizedPriority = String(body.priority || "normal").trim() || "normal";

    const rows = await prisma.$queryRaw<OperatorNoteRow[]>`
      update public.conversations
      set
        operator_note = ${normalizedNote},
        operator_tag = ${normalizedTag},
        operator_priority = ${normalizedPriority},
        operator_note_updated_at = now()
      where id = CAST(${conversationId} AS uuid)
        and tenant_id = CAST(${tenant.tenantId} AS uuid)
      returning
        id as conversation_id,
        operator_note,
        operator_tag,
        operator_priority,
        operator_note_updated_at
    `;

    const row = rows[0];

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Conversation not found for merchant" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        conversationId: row.conversation_id,
        operatorNote: row.operator_note,
        operatorTag: row.operator_tag,
        operatorPriority: row.operator_priority,
        operatorNoteUpdatedAt: toIso(row.operator_note_updated_at),
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
