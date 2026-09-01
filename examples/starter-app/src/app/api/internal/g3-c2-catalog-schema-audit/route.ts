import { NextResponse } from 'next/server';

import { runIkasCatalogSchemaAudit } from '@/lib/catalog/ikas-catalog-schema-audit';
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
      merchantId: {
        not: '',
      },
      authorizedAppId: {
        not: null,
      },
      NOT: {
        authorizedAppId: '',
      },
    },
    select: {
      merchantId: true,
      authorizedAppId: true,
    },
    orderBy: {
      updatedAt: 'desc',
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

export async function GET() {
  try {
    if (process.env.VERCEL_ENV === 'production') {
      return NextResponse.json(
        {
          ok: false,
          mutationPerformed: false,
          credentialMutationPerformed: false,
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
          credentialMutationPerformed: false,
          error: 'PREVIEW_IDENTITY_NOT_UNIQUE',
          message:
            'Preview audit için tek ve aktif bir commerce OAuth identity belirlenemedi.',
        },
        { status: 409 },
      );
    }

    const execution = await runIkasCatalogSchemaAudit({
      merchantId: identity.merchantId,
      authorizedAppId: identity.authorizedAppId,
    });

    return NextResponse.json(
      {
        ...execution.body,
        previewIdentitySource: identity.source,
      },
      {
        status: execution.status,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mutationPerformed: false,
        credentialMutationPerformed: false,
        error:
          error instanceof Error
            ? error.message
            : 'UNKNOWN_PREVIEW_AUDIT_ERROR',
      },
      { status: 500 },
    );
  }
}
