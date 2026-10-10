import { getUserFromRequest } from '@/lib/auth-helpers';
import { executeIkasCatalogFetch } from '@/lib/catalog/ikas-catalog-fetch-service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        runId: null,
        sourceName: null,
        queuedCount: 0,
        queuedExternalProductIds: [],
        error: 'Unauthorized',
        message: 'Katalog sync için ikas iframe JWT gerekli.',
      },
      { status: 401 },
    );
  }

  const merchantId = String(user.merchantId ?? '').trim();
  const authorizedAppId = String(user.authorizedAppId ?? '').trim();

  if (!merchantId || !authorizedAppId) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        runId: null,
        sourceName: null,
        queuedCount: 0,
        queuedExternalProductIds: [],
        error: 'IKAS_IDENTITY_CONTRACT_INCOMPLETE',
        message:
          'ikas JWT kimliği merchant_id ve authorized_app_id alanlarının ikisini de içermelidir.',
      },
      { status: 400 },
    );
  }

  const result = await executeIkasCatalogFetch({
    merchantId,
    authorizedAppId,
  });

  return NextResponse.json(result.body, {
    status: result.status,
  });
}
