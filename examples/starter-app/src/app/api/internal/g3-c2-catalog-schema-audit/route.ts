import { NextRequest, NextResponse } from 'next/server';

import { JwtHelpers } from '@/helpers/jwt-helpers';
import { getSession } from '@/lib/session';

function normalizeIdentity(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export async function GET(request: NextRequest) {
  try {
    if (process.env.VERCEL_ENV === 'production') {
      return NextResponse.json(
        {
          ok: false,
          mutationPerformed: false,
          error: 'Not found',
        },
        { status: 404 },
      );
    }

    const session = await getSession();
    const merchantId = normalizeIdentity(session.merchantId);
    const authorizedAppId = normalizeIdentity(session.authorizedAppId);

    if (!merchantId || !authorizedAppId) {
      return NextResponse.json(
        {
          ok: false,
          mutationPerformed: false,
          error: 'PREVIEW_SESSION_REQUIRED',
          message:
            'Preview OAuth oturumu bulunamadı. Önce bu preview deployment üzerinde mağaza yetkilendirmesini tamamlayın.',
        },
        { status: 401 },
      );
    }

    const jwtToken = JwtHelpers.createToken(
      merchantId,
      authorizedAppId,
    );

    const auditUrl = new URL(
      '/api/ikas/catalog-schema-audit',
      request.url,
    );

    const upstream = await fetch(auditUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: 'JWT ' + jwtToken,
      },
    });

    const responseText = await upstream.text();

    return new NextResponse(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ||
          'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mutationPerformed: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown preview audit bridge error',
      },
      { status: 500 },
    );
  }
}
