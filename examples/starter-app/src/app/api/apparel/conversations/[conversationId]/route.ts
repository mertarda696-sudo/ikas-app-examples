import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getConversationDetailByMerchantId } from "@/lib/apparel-panel/queries";

type CrmProfileRow = {
  crm_tag: string | null;
  risk_level: string | null;
  followup_status: string | null;
  internal_note: string | null;
  reviewed_at: Date | string | null;
  updated_at: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function getCustomerCrmProfile(tenantId: string, customerWaId: string | null | undefined) {
  const normalizedCustomerWaId = String(customerWaId || "").trim();

  if (!normalizedCustomerWaId) {
    return null;
  }

  const rows = await prisma.$queryRaw<CrmProfileRow[]>`
    select
      crm_tag,
      risk_level,
      followup_status,
      internal_note,
      reviewed_at,
      updated_at
    from public.customer_crm_profiles
    where tenant_id = CAST(${tenantId} AS uuid)
      and customer_wa_id = ${normalizedCustomerWaId}
    limit 1
  `;

  const row = rows[0] || null;

  if (!row) {
    return null;
  }

  return {
    crmProfileExists: true,
    crmTag: row.crm_tag || "general",
    riskLevel: row.risk_level || "normal",
    followupStatus: row.followup_status || "none",
    crmInternalNote: row.internal_note,
    crmReviewedAt: toIso(row.reviewed_at),
    crmUpdatedAt: toIso(row.updated_at),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          conversation: null,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { conversationId } = await params;
    const result = await getConversationDetailByMerchantId(
      user.merchantId,
      conversationId,
    );

    if (!result.ok || !result.tenant || !result.conversation) {
      return NextResponse.json(result, {
        status: result.ok ? 200 : 404,
      });
    }

    const crm = await getCustomerCrmProfile(
      result.tenant.tenantId,
      result.conversation.customerId,
    );

    return NextResponse.json(
      {
        ...result,
        conversation: {
          ...result.conversation,
          crmProfileExists: Boolean(crm),
          crmTag: crm?.crmTag || "general",
          riskLevel: crm?.riskLevel || "normal",
          followupStatus: crm?.followupStatus || "none",
          crmInternalNote: crm?.crmInternalNote || null,
          crmReviewedAt: crm?.crmReviewedAt || null,
          crmUpdatedAt: crm?.crmUpdatedAt || null,
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
        conversation: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
