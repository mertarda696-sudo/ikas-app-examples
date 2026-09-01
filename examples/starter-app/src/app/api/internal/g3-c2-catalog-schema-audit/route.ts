import { NextRequest, NextResponse } from 'next/server';

import { JwtHelpers } from '@/helpers/jwt-helpers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

function normalizeIdentity(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

async function resolvePreviewAuditIdentity(): Promise<{
  merchantId: string;
  authorizedAppId: string;
  source: 'preview_session' | 'single_active_auth_token';
} | null> {
  const session = await getSession();

  const sessionMerchantId = normalizeIdentity(session.merchantId);
  const sessionAuthorizedAppId = normalizeIdentity(
    session.authorizedAppId,
  );

  if (sessionMerchantId && sessionAuthorizedAppId) {
    return {
      merchantId: sessionMerchantId,
      authorizedAppId: sessionAuthorizedAppId,
      source: 'preview_session',
    };
  }

  const activeTokenIdentities = await prisma.authToken.findMany({
    where: {
      deleted: false,
      authorizedAppId: {
        not: null,
      },
    },
    select: {
      merchantId: true,
      authorizedAppId: true,
    },
    take: 2,
  });

  const candidates = activeTokenIdentities
    .map((token) => ({
      merchantId: normalizeIdentity(token.merchantId),
      authorizedAppId: normalizeIdentity(token.authorizedAppId),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        merchantId: string;
        authorizedAppId: string;
      } => Boolean(candidate.merchantId && candidate.authorizedAppId),
    );

  if (candidates.length !== 1) {
    return null;
  }

  return {
    merchantId: candidates[0].merchantId,
    authorizedAppId: candidates[0].authorizedAppId,
    source: 'single_active_auth_token',
  };
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

    const identity = await resolvePreviewAuditIdentity();

    if (!identity) {
      return NextResponse.json(
        {
          ok: false,
          mutationPerformed: false,
          error: 'PREVIEW_IDENTITY_NOT_UNIQUE',
          message:
            'Preview audit için tek ve aktif bir commerce OAuth identity belirlenemedi. Session veya tek aktif AuthToken gereklidir.',
        },
        { status: 409 },
      );
    }

    const jwtToken = JwtHelpers.createToken(
      identity.merchantId,
      identity.authorizedAppId,
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

    let responseBody: Record<string, unknown> | null = null;

    try {
      responseBody = responseText
        ? (JSON.parse(responseText) as Record<string, unknown>)
        : null;
    } catch {
      responseBody = null;
    }

    if (responseBody) {
      responseBody.previewIdentitySource = identity.source;
    }

    return new NextResponse(
      responseBody
        ? JSON.stringify(responseBody)
        : responseText,
      {
        status: upstream.status,
        headers: {
          'Content-Type':
            upstream.headers.get('content-type') ||
            'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      },
    );
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
