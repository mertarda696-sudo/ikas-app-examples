import { config } from '@/globals/config';
import { isIkasTokenRefreshDue } from '@/helpers/api-helpers';
import {
  listActiveIkasCatalogIdentities,
} from '@/lib/catalog/ikas-catalog-fetch-service';
import {
  fetchIkasProductTraversal,
  IkasProductTraversalError,
} from '@/lib/catalog/ikas-product-traversal';
import { PaginatedTraversalError } from '@/lib/catalog/paginated-traversal';
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

    return json({
      ok: true,
      ...base,
      stage: 'upstream_read_pass',
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
