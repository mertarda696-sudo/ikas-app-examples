import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import {
  isIkasTokenRefreshDue,
  onCheckToken,
} from '@/helpers/api-helpers';
import { config } from '@/globals/config';
import {
  CommerceSourceResolutionError,
  resolveCatalogSourceByCommerceIdentity,
  type CatalogSourceResolution,
} from '@/lib/catalog/commerce-source-resolver';
import {
  CatalogFetchOutcomeError,
  persistCatalogFetchOutcome,
} from '@/lib/catalog/catalog-fetch-outcome-writer';
import {
  CatalogFetchRunContractError,
  type CatalogFetchRunContractWriteResult,
} from '@/lib/catalog/catalog-fetch-run-contract-writer';
import {
  fetchIkasProductTraversal,
  IkasProductTraversalError,
  IKAS_PRODUCT_PAGE_SIZE,
  IKAS_PRODUCT_SORT,
  IKAS_PRODUCT_TRAVERSAL_CONTRACT_VERSION,
} from '@/lib/catalog/ikas-product-traversal';
import { PaginatedTraversalError } from '@/lib/catalog/paginated-traversal';
import { NextRequest, NextResponse } from 'next/server';

type PayloadItem = {
  id: string;
  is_active: boolean;
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

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
}

function slugify(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSourceStatus(value: string | null | undefined) {
  return normalizeText(value).toUpperCase();
}

function isPassiveSalesChannelStatus(value: string | null | undefined) {
  return ['PASSIVE', 'INACTIVE', 'DISABLED', 'HIDDEN'].includes(
    normalizeSourceStatus(value),
  );
}

const APPAREL_COLOR_ALIASES: Array<[string, string]> = [
  ['siyah', 'siyah'],
  ['beyaz', 'beyaz'],
  ['ekru', 'ekru'],
  ['vizon', 'vizon'],
  ['tas', 'taş'],
  ['taş', 'taş'],
  ['bej', 'bej'],
  ['mavi', 'mavi'],
  ['lacivert', 'lacivert'],
  ['gri', 'gri'],
  ['haki', 'haki'],
  ['kahve', 'kahve'],
  ['kahverengi', 'kahverengi'],
  ['bordo', 'bordo'],
  ['krem', 'krem'],
];

function extractColorFromText(...values: Array<string | null | undefined>) {
  const merged = normalizeText(values.filter(Boolean).join(' '));

  for (const [needle, canonical] of APPAREL_COLOR_ALIASES) {
    if (merged.includes(normalizeText(needle))) {
      return canonical;
    }
  }

  return null;
}

const COLOR_OPTION_ALIASES = ['renk', 'color', 'colour'];

const APPAREL_SIZE_OPTION_ALIASES = [
  'beden',
  'size',
  'talla',
];

const NUMBER_OPTION_ALIASES = [
  'numara',
  'number',
  'ayakkabi numarasi',
  'ayakkabı numarası',
  'ayakkabi numarası',
  'ayakkabı numarasi',
  'shoe number',
  'shoe size',
];

const EYEWEAR_FRAME_OPTION_ALIASES = [
  'ekartman',
  'ekartman ölçüsü',
  'ekartman olcusu',
  'frame size',
  'frame',
  'lens width',
  'cam genisligi',
  'cam genişliği',
];

const ONE_SIZE_OPTION_ALIASES = [
  'standart',
  'tek beden',
  'one size',
  'standard',
];

const FOOTWEAR_HINTS = [
  'ayakkabi',
  'ayakkabı',
  'topuklu',
  'sandalet',
  'terlik',
  'bot',
  'cizme',
  'çizme',
  'sneaker',
];

const EYEWEAR_HINTS = [
  'gozluk',
  'gözlük',
  'gunes gozlugu',
  'güneş gözlüğü',
  'cat eye',
  'eyewear',
  'sunglasses',
];

const NUMERIC_APPAREL_HINTS = [
  'pantolon',
  'etek',
  'elbise',
  'sort',
  'şort',
  'jean',
  'denim',
];

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
}

function hasAnyHint(surface: string, hints: string[]) {
  const normalizedSurface = normalizeText(surface);

  return hints.some((hint) =>
    normalizedSurface.includes(normalizeText(hint)),
  );
}

function isNumericLike(value: string | null | undefined) {
  return /^\d{1,3}$/.test(String(value || '').trim());
}

function getVariantOptionRows(variantValues: any[]) {
  return variantValues
    .map((value: any) => {
      const typeName = String(value?.variantTypeName || '').trim();
      const valueName = String(value?.variantValueName || '').trim();

      return {
        typeName,
        normalizedTypeName: normalizeText(typeName),
        valueName,
      };
    })
    .filter((value) => value.typeName || value.valueName);
}

function getVariantOptionMatch(
  variantValues: any[],
  aliases: string[],
) {
  const aliasSet = new Set(aliases.map((alias) => normalizeText(alias)));

  return getVariantOptionRows(variantValues).find((value) =>
    aliasSet.has(value.normalizedTypeName),
  ) || null;
}

function getVariantOptionValue(
  variantValues: any[],
  aliases: string[],
) {
  return getVariantOptionMatch(variantValues, aliases)?.valueName ?? null;
}

function resolveVariantSizeOption(input: {
  variantValues: any[];
  productName: string | null | undefined;
  categoryName: string | null | undefined;
}) {
  const variantValues = Array.isArray(input.variantValues)
    ? input.variantValues
    : [];

  const optionRows = getVariantOptionRows(variantValues);

  const productSurface = [
    input.productName,
    input.categoryName,
  ].filter(Boolean).join(' ');

  const isFootwear = hasAnyHint(productSurface, FOOTWEAR_HINTS);
  const isEyewear = hasAnyHint(productSurface, EYEWEAR_HINTS);
  const isNumericApparel = hasAnyHint(productSurface, NUMERIC_APPAREL_HINTS);

  const apparelSizeMatch = getVariantOptionMatch(
    variantValues,
    APPAREL_SIZE_OPTION_ALIASES,
  );

  const numberMatch = getVariantOptionMatch(
    variantValues,
    NUMBER_OPTION_ALIASES,
  );

  const eyewearFrameMatch = getVariantOptionMatch(
    variantValues,
    EYEWEAR_FRAME_OPTION_ALIASES,
  );

  const oneSizeMatch = getVariantOptionMatch(
    variantValues,
    ONE_SIZE_OPTION_ALIASES,
  );

  const apparelSizeValue = apparelSizeMatch?.valueName || null;
  const numberValue = numberMatch?.valueName || null;
  const eyewearFrameValue = eyewearFrameMatch?.valueName || null;
  const oneSizeValue = oneSizeMatch?.valueName || null;

  if (isEyewear && eyewearFrameValue) {
    return {
      size_value: eyewearFrameValue,
      size_system: 'eyewear_frame',
      variant_dimension: 'frame_size',
      size_source_option_name: eyewearFrameMatch?.typeName || null,
      option_type_names: uniqueNonEmpty(optionRows.map((value) => value.typeName)),
      option_values: optionRows,
    };
  }

  if (
    isFootwear &&
    (
      numberValue ||
      (apparelSizeValue && isNumericLike(apparelSizeValue))
    )
  ) {
    return {
      size_value: numberValue || apparelSizeValue,
      size_system: 'shoe_number',
      variant_dimension: 'shoe_number',
      size_source_option_name:
        numberMatch?.typeName ||
        apparelSizeMatch?.typeName ||
        null,
      option_type_names: uniqueNonEmpty(optionRows.map((value) => value.typeName)),
      option_values: optionRows,
    };
  }

  if (
    isNumericApparel &&
    (
      (apparelSizeValue && isNumericLike(apparelSizeValue)) ||
      (numberValue && isNumericLike(numberValue))
    )
  ) {
    return {
      size_value: apparelSizeValue || numberValue,
      size_system: 'numeric_apparel',
      variant_dimension: 'apparel_numeric_size',
      size_source_option_name:
        apparelSizeMatch?.typeName ||
        numberMatch?.typeName ||
        null,
      option_type_names: uniqueNonEmpty(optionRows.map((value) => value.typeName)),
      option_values: optionRows,
    };
  }

  if (apparelSizeValue) {
    return {
      size_value: apparelSizeValue,
      size_system: isNumericLike(apparelSizeValue) ? 'numeric_apparel' : 'alpha',
      variant_dimension: isNumericLike(apparelSizeValue)
        ? 'apparel_numeric_size'
        : 'apparel_alpha_size',
      size_source_option_name: apparelSizeMatch?.typeName || null,
      option_type_names: uniqueNonEmpty(optionRows.map((value) => value.typeName)),
      option_values: optionRows,
    };
  }

  if (numberValue) {
    return {
      size_value: numberValue,
      size_system: isNumericLike(numberValue) ? 'generic_number' : 'number',
      variant_dimension: 'number',
      size_source_option_name: numberMatch?.typeName || null,
      option_type_names: uniqueNonEmpty(optionRows.map((value) => value.typeName)),
      option_values: optionRows,
    };
  }

  if (eyewearFrameValue) {
    return {
      size_value: eyewearFrameValue,
      size_system: 'eyewear_frame',
      variant_dimension: 'frame_size',
      size_source_option_name: eyewearFrameMatch?.typeName || null,
      option_type_names: uniqueNonEmpty(optionRows.map((value) => value.typeName)),
      option_values: optionRows,
    };
  }

  if (oneSizeValue) {
    return {
      size_value: oneSizeValue,
      size_system: 'one_size',
      variant_dimension: 'standard',
      size_source_option_name: oneSizeMatch?.typeName || null,
      option_type_names: uniqueNonEmpty(optionRows.map((value) => value.typeName)),
      option_values: optionRows,
    };
  }

  return {
    size_value: null,
    size_system: 'unknown',
    variant_dimension: null,
    size_source_option_name: null,
    option_type_names: uniqueNonEmpty(optionRows.map((value) => value.typeName)),
    option_values: optionRows,
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
    const response = await fetch(webhookUrl, {
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

    const responseText = await response.text();

    let responseBody: unknown = null;

    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseBody = responseText;
    }

    return {
      configured: true,
      ok: response.ok,
      status: response.status,
      response: responseBody,
      error: response.ok
        ? null
        : 'Catalog import webhook returned HTTP ' + response.status,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      status: null,
      response: null,
      error: error instanceof Error ? error.message : 'Unknown import trigger error',
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
    pagination_sort:
      input.traversal?.sort ?? IKAS_PRODUCT_SORT,
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
    pagination_sort:
      input.traversal?.sort ?? IKAS_PRODUCT_SORT,
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

export async function POST(request: NextRequest) {
  try {
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

    const syncMerchantId = String(user.merchantId ?? '').trim();
    const syncAuthorizedAppId = String(
      user.authorizedAppId ?? '',
    ).trim();

    if (!syncMerchantId || !syncAuthorizedAppId) {
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

    const authToken = await AuthTokenManager.getActiveByIdentity({
      authorizedAppId: syncAuthorizedAppId,
      merchantId: syncMerchantId,
    });

    if (!authToken?.accessToken) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'Auth token not found',
          message: 'Aktif ikas OAuth token kaydı bulunamadı.',
        },
        { status: 404 },
      );
    }

    const tokenRefreshDue = isIkasTokenRefreshDue(authToken);
    const refreshedTokenResult = await onCheckToken(authToken);

    const ikasAccessToken =
      refreshedTokenResult.accessToken ||
      (!tokenRefreshDue ? authToken.accessToken : null);

    if (!ikasAccessToken) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'IKAS_TOKEN_REFRESH_FAILED',
          message:
            'ikas OAuth token süresi dolmuş ve refresh edilemedi. Bağlı ikas hesabının yeniden yetkilendirilmesi gerekiyor.',
        },
        { status: 401 },
      );
    }

    if (!config.graphApiUrl) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'Graph API URL not configured',
        },
        { status: 500 },
      );
    }

    let catalogSource: CatalogSourceResolution;

    try {
      catalogSource = await resolveCatalogSourceByCommerceIdentity({
        providerKey: IKAS_SOURCE_PLATFORM,
        bindingRole: 'catalog_feed',
        identities: [
          {
            identifierType: 'merchant_id',
            identifierValue: syncMerchantId,
          },
          {
            identifierType: 'authorized_app_id',
            identifierValue: syncAuthorizedAppId,
          },
        ],
      });
    } catch (error) {
      if (error instanceof CommerceSourceResolutionError) {
        const status =
          error.code === 'COMMERCE_SOURCE_AMBIGUOUS'
            ? 409
            : error.code === 'COMMERCE_SOURCE_NOT_FOUND'
              ? 404
              : 400;

        return NextResponse.json(
          {
            ok: false,
            fetchedAt: new Date().toISOString(),
            runId: null,
            sourceName: null,
            queuedCount: 0,
            queuedExternalProductIds: [],
            error: error.code,
            message: error.message,
          },
          { status },
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

        return NextResponse.json(
          {
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
          },
          { status: errorStatus },
        );
      }

      throw error;
    }

    const fetchFinishedAt = new Date().toISOString();
    const fetchedItems = productTraversal.items;

    const payloadItems = fetchedItems
      .map((item: any) => {
        const firstCategoryName =
          Array.isArray(item?.categories) && item.categories.length
            ? item.categories[0]?.name || null
            : null;

        const normalizedCategory = slugify(firstCategoryName) || 'unknown';
        const sourceBrandName = item?.brand?.name ?? null;
        const totalStock =
          typeof item?.totalStock === 'number' ? item.totalStock : null;
        const sourceSalesChannels = Array.isArray(item?.salesChannels)
          ? item.salesChannels
          : [];
        const sourceSalesChannelStatuses = sourceSalesChannels
          .map((channel: any) => channel?.status ?? null)
          .filter(Boolean);
        const sourceSalesChannelIsPassive = sourceSalesChannelStatuses.some(
          (status: string) => isPassiveSalesChannelStatus(status),
        );
        const productIsActive =
          item?.deleted !== true && !sourceSalesChannelIsPassive;

        const variantsRaw = Array.isArray(item?.variants)
          ? item.variants
          : [];

        const normalizedVariants = variantsRaw
          .map((variant: any) => {
            const variantValues = Array.isArray(variant?.variantValues)
              ? variant.variantValues
              : [];

            const optionSummary =
              variantValues
                .map((value: any) => {
                  const typeName = value?.variantTypeName ?? '';
                  const valueName = value?.variantValueName ?? '';
                  return [typeName, valueName]
                    .filter(Boolean)
                    .join(': ');
                })
                .filter(Boolean)
                .join(' / ') || null;

            const sizeMeta = resolveVariantSizeOption({
              variantValues,
              productName: item?.name,
              categoryName: firstCategoryName,
            });

            const sizeValue = sizeMeta.size_value;

            const colorValue =
              getVariantOptionValue(
                variantValues,
                COLOR_OPTION_ALIASES,
              ) ||
              extractColorFromText(
                item?.name,
                optionSummary,
                variant?.sku,
              );

            const prices = Array.isArray(variant?.prices)
              ? variant.prices
              : [];
            const firstPrice = prices[0] || null;
            const sellPrice =
              typeof firstPrice?.sellPrice === 'number'
                ? firstPrice.sellPrice
                : null;

            const stocks = Array.isArray(variant?.stocks)
              ? variant.stocks
              : [];
            const stockQty = stocks.reduce(
              (sum: number, stock: any) => {
                const count =
                  typeof stock?.stockCount === 'number'
                    ? stock.stockCount
                    : 0;
                return sum + count;
              },
              0,
            );

            const stockStatus = !productIsActive
              ? 'out_of_stock'
              : stockQty > 0
                ? 'in_stock'
                : variant?.sellIfOutOfStock === true
                  ? 'preorder'
                  : 'out_of_stock';

            return {
              id: variant?.id ?? '',
              external_product_id: item?.id ?? '',
              sku: variant?.sku ?? null,
              title: optionSummary,
              color: colorValue,
              size: sizeValue,
              price: sellPrice,
              stock_qty: productIsActive ? stockQty : 0,
              stock_status: stockStatus,
              is_active: productIsActive,
              sell_if_out_of_stock:
                variant?.sellIfOutOfStock ?? null,

              source_option_summary: optionSummary,
              source_option_values: sizeMeta.option_values,
              source_option_type_names:
                sizeMeta.option_type_names,
              source_size_system: sizeMeta.size_system,
              source_variant_dimension:
                sizeMeta.variant_dimension,
              source_size_option_name:
                sizeMeta.size_source_option_name,

              stock_preview: stocks
                .slice(0, 10)
                .map((stock: any) => ({
                  stock_location_id:
                    stock?.stockLocationId ?? null,
                  stock_count:
                    typeof stock?.stockCount === 'number'
                      ? stock.stockCount
                      : null,
                })),
            };
          })
          .filter((variant: { id: string }) => !!variant.id);

        const sourceOptionTypeNames = uniqueNonEmpty(
          normalizedVariants.flatMap((variant: any) =>
            Array.isArray(variant.source_option_type_names)
              ? variant.source_option_type_names
              : [],
          ),
        );

        const sourceSizeSystems = uniqueNonEmpty(
          normalizedVariants.map(
            (variant: any) => variant.source_size_system,
          ),
        );

        const sourceVariantDimensions = uniqueNonEmpty(
          normalizedVariants.map(
            (variant: any) => variant.source_variant_dimension,
          ),
        );

        return {
          id: item?.id ?? '',
          brand: sourceBrandName,
          title: item?.name ?? '-',
          handle: slugify(item?.name) || item?.id || '',
          category: normalizedCategory,
          currency: 'TRY',
          variants: normalizedVariants,
          is_active: productIsActive,
          attributes: {
            source_platform: 'ikas',
            sync_origin: 'ikas_app',
            merchant_id: syncMerchantId,
            store_name: sourceStoreName,
            source_deleted: item?.deleted === true,
            source_sales_channels: sourceSalesChannels,
            source_sales_channel_statuses:
              sourceSalesChannelStatuses,
            source_sales_channel_is_passive:
              sourceSalesChannelIsPassive,
            source_category_name: firstCategoryName,
            source_brand_name: sourceBrandName,
            source_total_stock: totalStock,
            source_short_description_present:
              !!item?.shortDescription,
            source_description_present: !!item?.description,
            source_variant_count: normalizedVariants.length,
            source_option_type_names: sourceOptionTypeNames,
            source_size_systems: sourceSizeSystems,
            source_variant_dimensions:
              sourceVariantDimensions,
            source_has_shoe_number_option:
              sourceSizeSystems.includes('shoe_number'),
            source_has_eyewear_frame_option:
              sourceSizeSystems.includes('eyewear_frame'),
            source_has_numeric_apparel_option:
              sourceSizeSystems.includes('numeric_apparel'),
            source_variant_price_mode: 'sell_price_only',
            source_variant_stock_mode: 'stocks_sum',
          },
          base_price: null,
          description: item?.description ?? null,
          subcategory: null,
          stock_status: !productIsActive
            ? 'out_of_stock'
            : totalStock == null
              ? 'unknown'
              : totalStock > 0
                ? 'in_stock'
                : 'out_of_stock',
          short_description: item?.shortDescription ?? null,
          external_product_id: item?.id ?? '',
          created_at_source:
            item?.createdAt != null
              ? String(item.createdAt)
              : null,
        };
      })
      .filter((item: { id: string }) => !!item.id);

    const passiveProductCount = payloadItems.filter(
      (item: PayloadItem) => item.is_active === false,
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
        outcome: zeroItems
          ? 'complete_zero_items'
          : 'complete',
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
      rawItems: payloadItems.map((item: Record<string, any>) => ({
        externalProductId: String(item.id),
        itemType: 'product' as const,
        payload: item,
      })),
    });

    const queuedExternalProductIds = payloadItems.map(
      (item: { id: string }) => item.id,
    );

    const importTrigger = await triggerCatalogImportProcess({
      runId: outcome.runId,
      tenantId: catalogSource.tenantId,
      catalogSourceId: catalogSource.catalogSourceId,
      sourceName: catalogSource.sourceName,
      queuedCount: payloadItems.length,
      queuedExternalProductIds,
    });

    return NextResponse.json({
      ok: true,
      fetchedAt: fetchFinishedAt,
      runId: outcome.runId,
      sourceName: catalogSource.sourceName,
      queuedCount: payloadItems.length,
      queuedExternalProductIds,
      zeroItems,
      traversal: traversalEvidence,
      fetchContract: summarizeFetchContract(
        outcome.fetchContract,
      ),
      importTrigger,
      error: undefined,
    });
  } catch (error) {
    if (
      error instanceof CatalogFetchOutcomeError ||
      error instanceof CatalogFetchRunContractError
    ) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: error.code,
          message: error.message,
        },
        { status: persistenceErrorStatus(error) },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        runId: null,
        sourceName: null,
        queuedCount: 0,
        queuedExternalProductIds: [],
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
