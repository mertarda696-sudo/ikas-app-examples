import { prisma } from '@/lib/prisma';
import {
  executeIkasCatalogFetch,
  listActiveIkasCatalogIdentities,
} from '@/lib/catalog/ikas-catalog-fetch-service';
import { NextRequest, NextResponse } from 'next/server';

const CONTROL_INTENT = 'controlled-live-fetch-v1';

type ExistingContractCountRow = {
  contract_count: number | string;
};

function json(
  body: Record<string, unknown>,
  status: number,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function fail(
  status: number,
  error: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return json(
    {
      ok: false,
      attempted: false,
      fetchedAt: new Date().toISOString(),
      error,
      message,
      ...extra,
    },
    status,
  );
}

function isSameOrigin(request: NextRequest) {
  const origin = String(request.headers.get('origin') ?? '').trim();
  return Boolean(origin) && origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return fail(
      404,
      'NOT_FOUND',
      'Controlled catalog fetch is available only on preview deployments.',
    );
  }

  if (!isSameOrigin(request)) {
    return fail(
      403,
      'CONTROL_ORIGIN_REJECTED',
      'Controlled catalog fetch requires a same-origin preview request.',
    );
  }

  const intent = String(
    request.headers.get('x-catalog-control-intent') ?? '',
  ).trim();

  if (intent !== CONTROL_INTENT) {
    return fail(
      403,
      'CONTROL_INTENT_REJECTED',
      'Controlled catalog fetch intent contract is missing or invalid.',
    );
  }

  const identities = await listActiveIkasCatalogIdentities();

  if (identities.length !== 1) {
    return fail(
      409,
      'CONTROL_IDENTITY_CARDINALITY_INVALID',
      'Controlled catalog fetch requires exactly one active typed IKAS catalog identity.',
      {
        activeTypedCatalogIdentityCount: identities.length,
      },
    );
  }

  const identity = identities[0];

  const existingRows = await prisma.$queryRaw<
    ExistingContractCountRow[]
  >`
    SELECT COUNT(*)::int AS contract_count
    FROM public.catalog_fetch_run_contracts fc
    WHERE fc.tenant_id = CAST(${identity.tenantId} AS uuid)
      AND fc.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
      AND fc.adapter_mode <> 'qa_fixture'
  `;

  const existingContractCount = Number(
    existingRows[0]?.contract_count ?? 0,
  );

  if (
    !Number.isInteger(existingContractCount) ||
    existingContractCount < 0
  ) {
    return fail(
      500,
      'CONTROL_HISTORY_CHECK_INVALID',
      'Controlled catalog fetch could not verify source authority history.',
    );
  }

  if (existingContractCount > 0) {
    return fail(
      409,
      'CONTROLLED_LIVE_FETCH_ALREADY_INITIALIZED',
      'A production typed fetch contract already exists for this catalog source. A second controlled initialization is blocked.',
      {
        existingProductionContractCount: existingContractCount,
      },
    );
  }

  const execution = await executeIkasCatalogFetch({
    merchantId: identity.merchantId,
    authorizedAppId: identity.authorizedAppId,
  });

  return json(
    {
      ...execution.body,
      attempted: true,
      controlContractVersion: CONTROL_INTENT,
    },
    execution.status,
  );
}
