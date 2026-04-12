import { NextResponse } from "next/server";

export async function GET() {
  try {
    const merchantRes = await fetch(
      `${process.env.NEXT_PUBLIC_DEPLOY_URL}/api/ikas/get-merchant`,
      {
        cache: "no-store",
      }
    );

    const merchantJson = await merchantRes.json();

    if (!merchantJson?.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Merchant bilgisi alınamadığı için products preview çalışmadı.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: false,
      count: 0,
      items: [],
      error:
        "Products preview route oluşturuldu. Şimdi bir sonraki adımda mevcut ikas client ile listProduct bağlanacak.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        count: 0,
        items: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
