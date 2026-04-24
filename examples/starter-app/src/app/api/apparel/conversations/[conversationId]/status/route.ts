import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { updateConversationStatusByMerchantId } from "@/lib/apparel-panel/mutations";

type StatusBody = {
  action?: "close" | "reopen";
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
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

    const { conversationId } = await params;
    const body = (await request.json().catch(() => ({}))) as StatusBody;

    if (body.action !== "close" && body.action !== "reopen") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid action. Expected close or reopen.",
        },
        { status: 400 },
      );
    }

    const result = await updateConversationStatusByMerchantId(
      user.merchantId,
      conversationId,
      body.action,
    );

    return NextResponse.json(
      {
        ok: true,
        conversationId: result.conversationId,
        status: result.status,
        closedAt: result.closedAt,
        closeReason: result.closeReason,
        reopenedAt: result.reopenedAt,
        reopenedFromStatus: result.reopenedFromStatus,
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
