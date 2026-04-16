import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { getCatalogHealthByMerchantId } from "@/lib/apparel-panel/queries";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          productCountTotal: 0,
          productCountActive: 0,
          variantCountTotal: 0,
          variantCountInStock: 0,
          variantCountPriced: 0,
          latestSync: null,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const result = await getCatalogHealthByMerchantId(user.merchantId);

    return NextResponse.json(result, {
      status: result.ok ? 200 : 404,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        productCountTotal: 0,
        productCountActive: 0,
        variantCountTotal: 0,
        variantCountInStock: 0,
        variantCountPriced: 0,
        latestSync: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
