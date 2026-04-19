import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import {
  getConversationSendContextByMerchantId,
  sendOperatorReplyViaN8n,
} from "@/lib/apparel-panel/mutations";

type ReplyBody = {
  replyText?: string;
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
    const body = (await request.json()) as ReplyBody;
    const replyText = String(body?.replyText || "").trim();

    if (!replyText) {
      return NextResponse.json(
        {
          ok: false,
          error: "replyText is required",
        },
        { status: 400 },
      );
    }

    const sendContext = await getConversationSendContextByMerchantId(
      user.merchantId,
      conversationId,
    );

    const result = await sendOperatorReplyViaN8n({
      conversationId: sendContext.conversationId,
      tenantId: sendContext.tenantId,
      toWaId: sendContext.toWaId,
      phoneNumberId: sendContext.phoneNumberId,
      merchantId: user.merchantId,
      replyText,
    });

    return NextResponse.json(
      {
        ok: true,
        conversationId: result.conversationId,
        externalMessageId: result.externalMessageId,
        replyText: result.replyText,
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
