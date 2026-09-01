import { config } from '@/globals/config';
import {
  isIkasTokenRefreshDue,
  onCheckToken,
} from '@/helpers/api-helpers';
import {
  CatalogFetchOutcomeError,
  persistCatalogFetchOutcome,
} from '@/lib/catalog/catalog-fetch-outcome-writer';
import {
  CatalogFetchRunContractError,
  type CatalogFetchRunContractWriteResult,
} from '@/lib/catalog/catalog-fetch-run-contract-writer';
import {
  normalizeIkasCatalogProducts,
  type NormalizedIkasCatalogProduct,
} from '@/lib/catalog/ikas-catalog-payload-normalizer';
import {
  CommerceSourceResolutionError,
  resolveCatalogSourceByCommerceIdentity,
  type CatalogSourceResolution,
} from '@/lib/catalog/commerce-source-resolver';
import {
  fetchIkasProductTraversal,
  IkasProductTraversalError,
  IKAS_PRODUCT_PAGE_SIZE,
  IKAS_PRODUCT_SORT,
  IKAS_PRODUCT_TRAVERSAL_CONTRACT_VERSION,
} from '@/lib/catalog/ikas-product-traversal';
import { PaginatedTraversalError } from '@/lib/catalog/paginated-traversal';
import { AuthTokenManager } from '@/models/auth-token/manager';

export type IkasCatalogIdentity = {
  merchantId: string;
  authorizedAppId: string;
};

export type ActiveIkasCatalogIdentity = IkasCatalogIdentity & {
  tenantId: string;
  catalogSourceId: string;
  bindingId: string;
};

export type IkasCatalogFetchExecution = {
  status: number;
  body: Record<string, unknown>;
};

type CatalogImportTriggerResult = {
  configured: boolean;
  ok: boolean;
  status: number | null;
  response: unknown;
  error: string | null;
};

type TraversalEvidence = {
  contractVersion: string;
  sort: string;
  pageSize: number;
  pagesFetched: number;
  upstreamCount: number;
  traversalComplete: boolean;
};

const IKAS_SOURCE_PLATFORM = 'ikas';
const IKAS_FETCH_MODE = 'ikas_app_json';
const IKAS_ADAPTER_MODE = 'ikas_admin_graphql';
const IKAS_FETCH_RUN_CONTRACT_VERSION = 'catalog_fetch_run_v1';
const IKAS_ADAPTER_EVIDENCE_VERSION =
  'ikas_fetch_adapter_evidence_v1';

function normalizeIdentity(value: unknown): string {
  return String(value ?? '').trim();
}

function response(
  status: number,
  body: Record<string, unknown>,
): IkasCatalogFetchExecution {
  return { status, body };
}

function emptyFailureBody(input: {
  error: string;
  message?: string;
  fetchedAt?: string;
}) {
  return {
    ok: false,
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    runId: null,
    sourceName: null,
    queuedCount: 0,
    queuedExternalProductIds: [],
    error: input.error,
    ...(input.message ? { message: input.message } : {}),
  };
}

async function triggerCatalogImportProcess(input: {
  runId: string;
  tenantId: string;
  catalogSourceId: string;
  sourceName: string;
  queuedCount: number;
  queuedExternalProductIds: string[];
}): Promise<CatalogImportTriggerResult> {
  const webhookUrl = process.env.N8N_CATALOG_IMPORT_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      configured: false,
      ok: false,
      status: null,
      response: null,
      error: 'N8N_CATALOG_IMPORT_WEBHOOK_URL is not configured',
    };
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'vercel_sync_products_to_queue',
        runId: input.runId,
        tenantId: input.tenantId,
        catalogSourceId: input.catalogSourceId,
        sourceName: input.sourceName,
        queuedCount: input.queuedCount,
        queuedExternalProductIds: input.queuedExternalProductIds,
        triggeredAt: new Date().toISOString(),
      }),
      cache: 'no-store',
    });

    const responseText = await webhookResponse.text();
    let responseBody: unknown = null;

    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseBody = responseText;
    }

    return {
      configured: true,
      ok: webhookResponse.ok,
      status: webhookResponse.status,
      response: responseBody,
      error: webhookResponse.ok
        ? null
        : `Catalog import webhook returned HTTP ${webhookResponse.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      status: null,
      response: null,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown import trigger error',
    };
  }
}

function summarizeFetchContract(
  contract: CatalogFetchRunContractWriteResult,
) {
  return {
    contractVersion: contract.contractVersion,
    authorityContractVersion: contract.authorityContractVersion,
    adapterMode: contract.adapterMode,
    fetchSemantics: contract.fetchSemantics,
    completionState: contract.completionState,
    traversalComplete: contract.traversalComplete,
    productCollectionComplete: contract.productCollectionComplete,
    variantCollectionComplete: contract.variantCollectionComplete,
    productReconciliationState: contract.productReconciliationState,
    variantReconciliationState: contract.variantReconciliationState,
    authorityBasis: contract.authorityBasis,
    authorityOrder: contract.authorityOrder,
  };
}

function buildRunMetadata(input: {
  catalogSource: CatalogSourceResolution;
  outcome: 'complete' | 'complete_zero_items' | 'failed';
  queuedCount: number;
  passiveProductCount?: number;
  traversal?: TraversalEvidence | null;
  errorCode?: string | null;
  errorStatus?: number | null;
}) {
  return {
    run_type: 'catalog_fetch',
    run_type_contract_version: IKAS_FETCH_RUN_CONTRACT_VERSION,
    source_adapter: 'ikas_sync_products_to_queue',
    source_platform: IKAS_SOURCE_PLATFORM,
    fetch_mode: IKAS_FETCH_MODE,
    trigger: 'ikas_app_catalog_fetch',
    source_name: input.catalogSource.sourceName,
    external_commerce_account_id:
      input.catalogSource.externalCommerceAccountId,
    catalog_source_account_binding_id:
      input.catalogSource.bindingId,
    binding_role: input.catalogSource.bindingRole,
    identity_resolution_contract_version:
      'commerce_source_resolver_v1',
    outcome: input.outcome,
    queued_count: input.queuedCount,
    passive_product_count: input.passiveProductCount ?? 0,
    traversal_contract_version:
      input.traversal?.contractVersion ??
      IKAS_PRODUCT_TRAVERSAL_CONTRACT_VERSION,
    pagination_sort: input.traversal?.sort ?? IKAS_PRODUCT_SORT,
    pagination_page_size:
      input.traversal?.pageSize ?? IKAS_PRODUCT_PAGE_SIZE,
    pages_fetched: input.traversal?.pagesFetched ?? null,
    upstream_count: input.traversal?.upstreamCount ?? null,
    traversal_complete:
      input.traversal?.traversalComplete ?? false,
    error_code: input.errorCode ?? null,
    error_status: input.errorStatus ?? null,
  };
}

function buildAdapterEvidence(input: {
  completionState: 'complete' | 'failed';
  traversal?: TraversalEvidence | null;
  collectedProductCount: number;
  errorCode?: string | null;
  errorStatus?: number | null;
}) {
  const complete = input.completionState === 'complete';

  return {
    evidence_contract_version: IKAS_ADAPTER_EVIDENCE_VERSION,
    source_platform: IKAS_SOURCE_PLATFORM,
    fetch_mode: IKAS_FETCH_MODE,
    traversal_contract_version:
      input.traversal?.contractVersion ??
      IKAS_PRODUCT_TRAVERSAL_CONTRACT_VERSION,
    pagination_sort: input.traversal?.sort ?? IKAS_PRODUCT_SORT,
    pagination_page_size:
      input.traversal?.pageSize ?? IKAS_PRODUCT_PAGE_SIZE,
    pages_fetched: input.traversal?.pagesFetched ?? null,
    upstream_product_count: input.traversal?.upstreamCount ?? null,
    collected_product_count: input.collectedProductCount,
    traversal_complete:
      complete && input.traversal?.traversalComplete === true,
    product_collection_complete: complete,
    variant_collection_complete: complete,
    variant_collection_completeness_reason: complete
      ? 'ikas_product_variants_direct_list_schema_proven'
      : 'fetch_not_complete',
    error_code: input.errorCode ?? null,
    error_status: input.errorStatus ?? null,
  };
}

function skippedImportTrigger(
  error: string,
): CatalogImportTriggerResult {
  return {
    configured: Boolean(process.env.N8N_CATALOG_IMPORT_WEBHOOK_URL),
    ok: false,
    status: null,
    response: null,
    error,
  };
}

function persistenceErrorStatus(
  error: CatalogFetchOutcomeError | CatalogFetchRunContractError,
) {
  if (error instanceof CatalogFetchOutcomeError) {
    return error.code === 'FETCH_OUTCOME_RUN_CREATE_FAILED'
      ? 500
      : 422;
  }

  return error.code === 'FETCH_CONTRACT_ALREADY_EXISTS' ||
    error.code === 'FETCH_CONTRACT_AUTHORITY_HISTORY_MIXED' ||
    error.code === 'FETCH_CONTRACT_AUTHORITY_BASIS_CHANGE_NOT_ALLOWED'
    ? 409
    : error.code === 'FETCH_CONTRACT_INVALID_INPUT' ||
        error.code === 'FETCH_CONTRACT_RUN_STATE_MISMATCH' ||
        error.code === 'FETCH_CONTRACT_AUTHORITY_ORDER_INVALID' ||
        error.code === 'FETCH_CONTRACT_SOURCE_OBSERVED_AT_INVALID' ||
        error.code === 'FETCH_CONTRACT_COLLECTION_INCONSISTENT' ||
        error.code === 'FETCH_CONTRACT_ADAPTER_EVIDENCE_INVALID'
      ? 422
      : 500;
}

async function resolveCatalogSource(
  identity: IkasCatalogIdentity,
): Promise<CatalogSourceResolution> {
  return resolveCatalogSourceByCommerceIdentity({
    providerKey: IKAS_SOURCE_PLATFORM,
    bindingRole: 'catalog_feed',
    identities: [
      {
        identifierType: 'merchant_id',
        identifierValue: identity.merchantId,
      },
      {
        identifierType: 'authorized_app_id',
        identifierValue: identity.authorizedAppId,
      },
    ],
  });
}

function sourceResolutionErrorStatus(error: CommerceSourceResolutionError) {
  return error.code === 'COMMERCE_SOURCE_AMBIGUOUS'
    ? 409
    : error.code === 'COMMERCE_SOURCE_NOT_FOUND'
      ? 404
      : 400;
}

export async function listActiveIkasCatalogIdentities(): Promise<
  ActiveIkasCatalogIdentity[]
> {
  const tokens = await AuthTokenManager.list();
  const candidates = new Map<string, ActiveIkasCatalogIdentity>();

  for (const token of tokens) {
    const merchantId = normalizeIdentity(token.merchantId);
    const authorizedAppId = normalizeIdentity(token.authorizedAppId);

    if (
      token.deleted ||
      !token.accessToken ||
      !merchantId ||
      !authorizedAppId
    ) {
      continue;
    }

    try {
      const source = await resolveCatalogSource({
        merchantId,
        authorizedAppId,
      });
      const key = [
        source.tenantId,
        source.catalogSourceId,
        source.bindingId,
        merchantId,
        authorizedAppId,
      ].join(':');

      candidates.set(key, {
        merchantId,
        authorizedAppId,
        tenantId: source.tenantId,
        catalogSourceId: source.catalogSourceId,
        bindingId: source.bindingId,
      });
    } catch (error) {
      if (
        error instanceof CommerceSourceResolutionError &&
        error.code === 'COMMERCE_SOURCE_NOT_FOUND'
      ) {
        continue;
      }

      throw error;
    }
  }

  return Array.from(candidates.values()).sort((a, b) =>
    [a.tenantId, a.catalogSourceId, a.bindingId]
      .join(':')
      .localeCompare([b.tenantId, b.catalogSourceId, b.bindingId].join(':')),
  );
}

export async function executeIkasCatalogFetch(
  input: IkasCatalogIdentity,
): Promise<IkasCatalogFetchExecution> {
  try {
    const merchantId = normalizeIdentity(input.merchantId);
    const authorizedAppId = normalizeIdentity(input.authorizedAppId);

    if (!merchantId || !authorizedAppId) {
      return response(
        400,
        emptyFailureBody({
          error: 'IKAS_IDENTITY_CONTRACT_INCOMPLETE',
          message:
            'ikas identity requires merchant_id and authorized_app_id.',
        }),
      );
    }

    const authToken = await AuthTokenManager.getActiveByIdentity({
      authorizedAppId,
      merchantId,
    });

    if (!authToken?.accessToken) {
      return response(
        404,
        emptyFailureBody({
          error: 'IKAS_AUTH_TOKEN_NOT_FOUND',
          message: 'Active ikas OAuth token was not found.',
        }),
      );
    }

    const tokenRefreshDue = isIkasTokenRefreshDue(authToken);
    const refreshedTokenResult = await onCheckToken(authToken);
    const ikasAccessToken =
      refreshedTokenResult.accessToken ||
      (!tokenRefreshDue ? authToken.accessToken : null);

    if (!ikasAccessToken) {
      return response(
        401,
        emptyFailureBody({
          error: 'IKAS_TOKEN_REFRESH_FAILED',
          message:
            'ikas OAuth token is expired and could not be refreshed.',
        }),
      );
    }

    if (!config.graphApiUrl) {
      return response(
        500,
        emptyFailureBody({
          error: 'IKAS_GRAPH_API_URL_NOT_CONFIGURED',
        }),
      );
    }

    let catalogSource: CatalogSourceResolution;

    try {
      catalogSource = await resolveCatalogSource({
        merchantId,
        authorizedAppId,
      });
    } catch (error) {
      if (error instanceof CommerceSourceResolutionError) {
        return response(
          sourceResolutionErrorStatus(error),
          emptyFailureBody({
            error: error.code,
            message: error.message,
          }),
        );
      }

      throw error;
    }

    const sourceConfig =
      catalogSource.sourceConfig &&
      typeof catalogSource.sourceConfig === 'object'
        ? catalogSource.sourceConfig
        : {};
    const sourceStoreName =
      typeof sourceConfig.store_name === 'string'
        ? sourceConfig.store_name
        : typeof sourceConfig.store_domain === 'string'
          ? sourceConfig.store_domain
          : typeof sourceConfig.domain === 'string'
            ? sourceConfig.domain
            : catalogSource.sourceName;

    const fetchStartedAt = new Date().toISOString();
    let productTraversal;

    try {
      productTraversal = await fetchIkasProductTraversal({
        graphApiUrl: config.graphApiUrl,
        accessToken: ikasAccessToken,
        mode: 'full',
      });
    } catch (error) {
      if (
        error instanceof IkasProductTraversalError ||
        error instanceof PaginatedTraversalError
      ) {
        const fetchFinishedAt = new Date().toISOString();
        const errorStatus =
          error instanceof IkasProductTraversalError
            ? error.status
            : 502;
        const failedOutcome = await persistCatalogFetchOutcome({
          tenantId: catalogSource.tenantId,
          catalogSourceId: catalogSource.catalogSourceId,
          catalogSourceAccountBindingId: catalogSource.bindingId,
          syncMode: 'full',
          startedAt: fetchStartedAt,
          finishedAt: fetchFinishedAt,
          notes: 'IKAS catalog fetch failed during product traversal',
          metadata: buildRunMetadata({
            catalogSource,
            outcome: 'failed',
            queuedCount: 0,
            errorCode: error.code,
            errorStatus,
          }),
          itemsSeen: 0,
          errorCount: 1,
          contract: {
            adapterMode: IKAS_ADAPTER_MODE,
            fetchSemantics: 'full_snapshot',
            completionState: 'failed',
            traversalComplete: false,
            productCollectionComplete: false,
            variantCollectionComplete: false,
            authority: {
              basis: 'fetch_completed_at',
            },
            adapterEvidence: buildAdapterEvidence({
              completionState: 'failed',
              collectedProductCount: 0,
              errorCode: error.code,
              errorStatus,
            }),
          },
          rawItems: [],
        });

        return response(errorStatus, {
          ok: false,
          fetchedAt: fetchFinishedAt,
          runId: failedOutcome.runId,
          sourceName: catalogSource.sourceName,
          queuedCount: 0,
          queuedExternalProductIds: [],
          traversalComplete: false,
          fetchContract: summarizeFetchContract(
            failedOutcome.fetchContract,
          ),
          importTrigger: skippedImportTrigger(
            'Fetch traversal failed, import trigger skipped',
          ),
          error: error.code,
          message: error.message,
        });
      }

      throw error;
    }

    const fetchFinishedAt = new Date().toISOString();
    const payloadItems = normalizeIkasCatalogProducts({
      items: productTraversal.items,
      merchantId,
      storeName: sourceStoreName,
    });
    const passiveProductCount = payloadItems.filter(
      (item: NormalizedIkasCatalogProduct) => item.is_active === false,
    ).length;
    const traversalEvidence: TraversalEvidence = {
      contractVersion: productTraversal.contractVersion,
      sort: productTraversal.sort,
      pageSize: productTraversal.pageSize,
      pagesFetched: productTraversal.pagesFetched,
      upstreamCount: productTraversal.upstreamCount,
      traversalComplete: productTraversal.traversalComplete,
    };
    const zeroItems = payloadItems.length === 0;

    const outcome = await persistCatalogFetchOutcome({
      tenantId: catalogSource.tenantId,
      catalogSourceId: catalogSource.catalogSourceId,
      catalogSourceAccountBindingId: catalogSource.bindingId,
      syncMode: 'full',
      startedAt: fetchStartedAt,
      finishedAt: fetchFinishedAt,
      notes: zeroItems
        ? 'IKAS catalog fetch completed with zero products'
        : 'IKAS catalog fetch completed and raw queue published',
      metadata: buildRunMetadata({
        catalogSource,
        outcome: zeroItems ? 'complete_zero_items' : 'complete',
        queuedCount: payloadItems.length,
        passiveProductCount,
        traversal: traversalEvidence,
      }),
      itemsSeen: productTraversal.upstreamCount,
      errorCount: 0,
      contract: {
        adapterMode: IKAS_ADAPTER_MODE,
        fetchSemantics: 'full_snapshot',
        completionState: 'complete',
        traversalComplete: productTraversal.traversalComplete,
        productCollectionComplete: true,
        variantCollectionComplete: true,
        authority: {
          basis: 'fetch_completed_at',
        },
        adapterEvidence: buildAdapterEvidence({
          completionState: 'complete',
          traversal: traversalEvidence,
          collectedProductCount: payloadItems.length,
        }),
      },
      rawItems: payloadItems.map((item) => ({
        externalProductId: String(item.id),
        itemType: 'product' as const,
        payload: item,
      })),
    });

    const queuedExternalProductIds = payloadItems.map((item) => item.id);
    const importTrigger = await triggerCatalogImportProcess({
      runId: outcome.runId,
      tenantId: catalogSource.tenantId,
      catalogSourceId: catalogSource.catalogSourceId,
      sourceName: catalogSource.sourceName,
      queuedCount: payloadItems.length,
      queuedExternalProductIds,
    });

    return response(200, {
      ok: true,
      fetchedAt: fetchFinishedAt,
      runId: outcome.runId,
      sourceName: catalogSource.sourceName,
      queuedCount: payloadItems.length,
      queuedExternalProductIds,
      zeroItems,
      traversal: traversalEvidence,
      fetchContract: summarizeFetchContract(outcome.fetchContract),
      importTrigger,
      error: undefined,
    });
  } catch (error) {
    if (
      error instanceof CatalogFetchOutcomeError ||
      error instanceof CatalogFetchRunContractError
    ) {
      return response(
        persistenceErrorStatus(error),
        emptyFailureBody({
          error: error.code,
          message: error.message,
        }),
      );
    }

    return response(
      500,
      emptyFailureBody({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      }),
    );
  }
}
