import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getInboxListByMerchantId } from "@/lib/apparel-panel/queries";

type CrmProfileRow = {
  customer_wa_id: string;
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

async function getCrmProfilesByCustomerIds(tenantId: string, customerIds: string[]) {
  const uniqueCustomerIds = Array.from(new Set(customerIds.map((item) => String(item || "").trim()).filter(Boolean)));
  const map = new Map<string, CrmProfileRow>();

  await Promise.all(
    uniqueCustomerIds.map(async (customerId) => {
      const rows = await prisma.$queryRaw<CrmProfileRow[]>`
        select
          customer_wa_id,
          crm_tag,
          risk_level,
          followup_status,
          internal_note,
          reviewed_at,
          updated_at
        from public.customer_crm_profiles
        where tenant_id = CAST(${tenantId} AS uuid)
          and customer_wa_id = ${customerId}
        limit 1
      `;

      if (rows[0]) {
        map.set(customerId, rows[0]);
      }
    }),
  );

  return map;
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
          items: [],
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const result = await getInboxListByMerchantId(user.merchantId);

    if (!result.ok || !result.tenant) {
      return NextResponse.json(result, {
        status: result.ok ? 200 : 404,
      });
    }

    const crmProfilesByCustomerId = await getCrmProfilesByCustomerIds(
      result.tenant.tenantId,
      result.items.map((item) => item.customerId || ""),
    );

    const items = result.items.map((item) => {
      const crm = item.customerId ? crmProfilesByCustomerId.get(item.customerId) : null;

      return {
        ...item,
        crmProfileExists: Boolean(crm),
        crmTag: crm?.crm_tag || "general",
        riskLevel: crm?.risk_level || "normal",
        followupStatus: crm?.followup_status || "none",
        crmInternalNote: crm?.internal_note || null,
        crmReviewedAt: toIso(crm?.reviewed_at),
        crmUpdatedAt: toIso(crm?.updated_at),
      };
    });

    return NextResponse.json(
      {
        ...result,
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
        items: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
