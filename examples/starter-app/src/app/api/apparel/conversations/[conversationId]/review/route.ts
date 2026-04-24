import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { markConversationReviewedByMerchantId } from "@/lib/apparel-panel/mutations";

type ReviewBody = {
  note?: string;
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
    const body = (await request.json().catch(() => ({}))) as ReviewBody;

    const result = await markConversationReviewedByMerchantId(
      user.merchantId,
      conversationId,
      body?.note,
    );

    return NextResponse.json(
      {
        ok: true,
        conversationId: result.conversationId,
        operatorReviewedAt: result.operatorReviewedAt,
        operatorReviewedBy: result.operatorReviewedBy,
        operatorReviewNote: result.operatorReviewNote,
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
