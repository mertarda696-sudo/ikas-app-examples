import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { getConversationDetailByMerchantId } from "@/lib/apparel-panel/queries";

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

    return NextResponse.json(result, {
      status: result.ok ? 200 : 404,
    });
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
