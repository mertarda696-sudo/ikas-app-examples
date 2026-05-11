import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { updateConversationAutomationByMerchantId } from "@/lib/apparel-panel/mutations";

type AutomationBody = {
  action?: "pause_ai" | "resume_ai";
  reason?: string;
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
    const body = (await request.json().catch(() => ({}))) as AutomationBody;

    if (body.action !== "pause_ai" && body.action !== "resume_ai") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid action. Expected pause_ai or resume_ai.",
        },
        { status: 400 },
      );
    }

    const result = await updateConversationAutomationByMerchantId(
      user.merchantId,
      conversationId,
      body.action,
      body.reason,
    );

    return NextResponse.json(
      {
        ok: true,
        conversationId: result.conversationId,
        aiMode: result.aiMode,
        aiPausedAt: result.aiPausedAt,
        aiPausedBy: result.aiPausedBy,
        aiPauseReason: result.aiPauseReason,
        aiResumeReminderAt: result.aiResumeReminderAt,
        aiResumedAt: result.aiResumedAt,
        aiResumedBy: result.aiResumedBy,
        aiModeUpdatedAt: result.aiModeUpdatedAt,
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
