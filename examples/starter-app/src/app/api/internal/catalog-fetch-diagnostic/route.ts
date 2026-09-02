import { config } from '@/globals/config';
import { isIkasTokenRefreshDue } from '@/helpers/api-helpers';
import {
  listActiveIkasCatalogIdentities,
} from '@/lib/catalog/ikas-catalog-fetch-service';
import { normalizeIkasCatalogProducts } from '@/lib/catalog/ikas-catalog-payload-normalizer';
import {
  fetchIkasProductTraversal,
  IkasProductTraversalError,
} from '@/lib/catalog/ikas-product-traversal';
import { PaginatedTraversalError } from '@/lib/catalog/paginated-traversal';
import { prisma } from '@/lib/prisma';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextResponse } from 'next/server';

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function errorEvidence(error: unknown) {
  if (error instanceof IkasProductTraversalError) {
    return {
      name: error.name,
      code: error.code,
      status: error.status,
      message: error.message,
    };
  }

  if (error instanceof PaginatedTraversalError) {
    return {
      name: error.name,
      code: error.code,
      status: 502,
      message: error.message,
    };
  }

  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    code: 'UNEXPECTED_RUNTIME_ERROR',
    status: 500,
    message: error instanceof Error ? error.message : 'Unknown runtime error',
  };
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        mutationPerformed: false,
        error: 'NOT_FOUND',
      },
      404,
    );
  }

  const fetchedAt = new Date().toISOString();

  try {
    const identities = await listActiveIkasCatalogIdentities();

    if (identities.length !== 1) {
      return json(
        {
          ok: false,
          fetchedAt,
          mutationPerformed: false,
          stage: 'typed_identity',
          activeTypedCatalogIdentityCount: identities.length,
          error: 'DIAGNOSTIC_IDENTITY_CARDINALITY_INVALID',
        },
        409,
      );
    }

    const identity = identities[0];
    const authToken = await AuthTokenManager.getActiveByIdentity({
      merchantId: identity.merchantId,
      authorizedAppId: identity.authorizedAppId,
    });

    const tokenFound = Boolean(authToken?.accessToken);
    const tokenRefreshDue = authToken
      ? isIkasTokenRefreshDue(authToken)
      : null;
    const expireAt = authToken?.expireDate
      ? new Date(authToken.expireDate)
      : null;
    const expireDeltaMs =
      expireAt && Number.isFinite(expireAt.getTime())
        ? expireAt.getTime() - Date.now()
        : null;

    const base = {
      fetchedAt,
      mutationPerformed: false,
      activeTypedCatalogIdentityCount: identities.length,
      token: {
        found: tokenFound,
        deleted: authToken?.deleted ?? null,
        refreshDue: tokenRefreshDue,
        expireDeltaMs,
      },
      graphApiConfigured: Boolean(String(config.graphApiUrl ?? '').trim()),
    };

    if (!authToken?.accessToken) {
      return json(
        {
          ok: false,
          ...base,
          stage: 'exact_token_lookup',
          error: 'IKAS_AUTH_TOKEN_NOT_FOUND',
        },
        404,
      );
    }

    if (!config.graphApiUrl) {
      return json(
        {
          ok: false,
          ...base,
          stage: 'graph_api_configuration',
          error: 'IKAS_GRAPH_API_URL_NOT_CONFIGURED',
        },
        500,
      );
    }

    let idOnlyTraversal;

    try {
      idOnlyTraversal = await fetchIkasProductTraversal({
        graphApiUrl: config.graphApiUrl,
        accessToken: authToken.accessToken,
        mode: 'id_only',
      });
    } catch (error) {
      return json(
        {
          ok: false,
          ...base,
          stage: 'id_only_traversal',
          traversalError: errorEvidence(error),
          error: 'IKAS_ID_ONLY_TRAVERSAL_FAILED',
        },
        200,
      );
    }

    let fullTraversal;

    try {
      fullTraversal = await fetchIkasProductTraversal({
        graphApiUrl: config.graphApiUrl,
        accessToken: authToken.accessToken,
        mode: 'full',
      });
    } catch (error) {
      return json(
        {
          ok: false,
          ...base,
          stage: 'full_traversal',
          idOnlyTraversal: {
            upstreamCount: idOnlyTraversal.upstreamCount,
            pagesFetched: idOnlyTraversal.pagesFetched,
            traversalComplete: idOnlyTraversal.traversalComplete,
          },
          traversalError: errorEvidence(error),
          error: 'IKAS_FULL_TRAVERSAL_FAILED',
        },
        200,
      );
    }

    let normalizedItems;
    let serializedByteLength = 0;

    try {
      normalizedItems = normalizeIkasCatalogProducts({
        items: fullTraversal.items,
        merchantId: identity.merchantId,
        storeName: 'diagnostic',
      });

      const serialized = JSON.stringify(normalizedItems);
      serializedByteLength = Buffer.byteLength(serialized, 'utf8');
    } catch (error) {
      return json(
        {
          ok: false,
          ...base,
          stage: 'normalization',
          idOnlyTraversal: {
            upstreamCount: idOnlyTraversal.upstreamCount,
            pagesFetched: idOnlyTraversal.pagesFetched,
            traversalComplete: idOnlyTraversal.traversalComplete,
          },
          fullTraversal: {
            upstreamCount: fullTraversal.upstreamCount,
            pagesFetched: fullTraversal.pagesFetched,
            traversalComplete: fullTraversal.traversalComplete,
          },
          normalizationError: errorEvidence(error),
          error: 'IKAS_NORMALIZATION_FAILED',
        },
        200,
      );
    }

    const variantCount = normalizedItems.reduce(
      (total, item) =>
        total + (Array.isArray(item.variants) ? item.variants.length : 0),
      0,
    );
    const stableProductIds = normalizedItems.every(
      (item) => String(item.id ?? '').trim().length > 0,
    );
    const uniqueProductIdCount = new Set(
      normalizedItems.map((item) => String(item.id)),
    ).size;

    let persistencePreflight;

    try {
      const lockKey =
        `catalog_source_lifecycle_v2:${identity.tenantId}:${identity.catalogSourceId}`;

      persistencePreflight = await prisma.$transaction(async (tx) => {
        const bindingRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT b.id::text AS id
          FROM public.catalog_source_account_bindings b
          JOIN public.catalog_sources s
            ON s.id = b.catalog_source_id
           AND s.tenant_id = b.tenant_id
          WHERE b.id = CAST(${identity.bindingId} AS uuid)
            AND b.tenant_id = CAST(${identity.tenantId} AS uuid)
            AND b.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
            AND b.is_active IS TRUE
            AND b.retired_at IS NULL
            AND s.is_active IS TRUE
          FOR UPDATE OF b, s
        `;

        if (!bindingRows[0]) {
          throw new Error('DIAGNOSTIC_BINDING_LOCK_NOT_AVAILABLE');
        }

        const lockRows = await tx.$queryRaw<Array<{ lock_acquired: boolean }>>`
          WITH lock_call AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(
              hashtextextended(${lockKey}, 0)
            )
          )
          SELECT TRUE AS lock_acquired
          FROM lock_call
        `;

        if (lockRows[0]?.lock_acquired !== true) {
          throw new Error('DIAGNOSTIC_ADVISORY_LOCK_NOT_CONFIRMED');
        }

        const basisRows = await tx.$queryRaw<Array<{ authority_basis: string }>>`
          SELECT DISTINCT fc.authority_basis
          FROM public.catalog_fetch_run_contracts fc
          WHERE fc.tenant_id = CAST(${identity.tenantId} AS uuid)
            AND fc.catalog_source_id = CAST(${identity.catalogSourceId} AS uuid)
            AND fc.adapter_mode <> 'qa_fixture'
          ORDER BY fc.authority_basis
        `;

        return {
          bindingRowLockAcquired: true,
          advisoryTransactionLockReturned: true,
          productionAuthorityBases: basisRows.map((row) => row.authority_basis),
        };
      });
    } catch (error) {
      return json(
        {
          ok: false,
          ...base,
          stage: 'persistence_lock_preflight',
          idOnlyTraversal: {
            upstreamCount: idOnlyTraversal.upstreamCount,
            pagesFetched: idOnlyTraversal.pagesFetched,
            traversalComplete: idOnlyTraversal.traversalComplete,
          },
          fullTraversal: {
            upstreamCount: fullTraversal.upstreamCount,
            pagesFetched: fullTraversal.pagesFetched,
            traversalComplete: fullTraversal.traversalComplete,
          },
          normalization: {
            productCount: normalizedItems.length,
            uniqueProductIdCount,
            variantCount,
            stableProductIds,
            jsonSerializable: true,
            serializedByteLength,
          },
          persistencePreflightError: errorEvidence(error),
          error: 'PERSISTENCE_LOCK_PREFLIGHT_FAILED',
        },
        200,
      );
    }

    return json({
      ok: true,
      ...base,
      stage: 'persistence_lock_preflight_pass',
      idOnlyTraversal: {
        upstreamCount: idOnlyTraversal.upstreamCount,
        pagesFetched: idOnlyTraversal.pagesFetched,
        traversalComplete: idOnlyTraversal.traversalComplete,
      },
      fullTraversal: {
        upstreamCount: fullTraversal.upstreamCount,
        pagesFetched: fullTraversal.pagesFetched,
        traversalComplete: fullTraversal.traversalComplete,
      },
      normalization: {
        productCount: normalizedItems.length,
        uniqueProductIdCount,
        variantCount,
        stableProductIds,
        jsonSerializable: true,
        serializedByteLength,
      },
      persistencePreflight,
      error: null,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        fetchedAt,
        mutationPerformed: false,
        stage: 'unexpected',
        diagnosticError: errorEvidence(error),
        error: 'DIAGNOSTIC_UNEXPECTED_ERROR',
      },
      200,
    );
  }
}
