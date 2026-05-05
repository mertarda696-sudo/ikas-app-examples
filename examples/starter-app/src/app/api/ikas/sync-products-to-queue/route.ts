import { getUserFromRequest } from '@/lib/auth-helpers';
import { config } from '@/globals/config';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

type SourceRow = {
  id: string;
  tenant_id: string;
  source_name: string;
};

const IKAS_SOURCE_NAME = 'MIRELLE IKAS App Catalog';
const PRODUCT_LIMIT = 50;
const MIRELLE_MERCHANT_ID = 'cfd8adc2-53e5-48ff-843a-10edd8b971a6';

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

function getVariantOptionValue(
  variantValues: any[],
  aliases: string[],
) {
  const match = variantValues.find((value: any) =>
    aliases.includes(normalizeText(value?.variantTypeName)),
  );

  return match?.variantValueName ?? null;
}

async function getFreshIkasAccessTokenForCatalogSync() {
  if (!config.oauth.clientId || !config.oauth.clientSecret) {
    throw new Error('IKAS_CLIENT_CREDENTIALS_NOT_CONFIGURED');
  }

  const response = await fetch('https://api.myikas.com/api/admin/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.oauth.clientId,
      client_secret: config.oauth.clientSecret,
    }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.access_token) {
    throw new Error(
      payload?.error_description ||
        payload?.error ||
        `IKAS_CLIENT_CREDENTIALS_TOKEN_FAILED_HTTP_${response.status}`,
    );
  }

  return {
    accessToken: String(payload.access_token),
    expiresIn: payload.expires_in ?? null,
    tokenType: payload.token_type ?? 'Bearer',
  };
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json().catch(() => ({}));

    const isPanelTrigger =
      request.headers.get('x-catalog-sync-source') === 'catalog_page_button' ||
      requestBody?.source === 'catalog_page_button' ||
      requestBody?.allowPanelTrigger === true;

    const requestUser = getUserFromRequest(request);

    if (!requestUser && !isPanelTrigger) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'Unauthorized',
          message:
            'Bu endpoint normal çağrıda JWT Authorization bekler. Panelden çağrı için catalog_page_button trigger bilgisi gelmeli.',
        },
        { status: 401 },
      );
    }

    const freshToken = await getFreshIkasAccessTokenForCatalogSync();

    const syncMerchantId = requestUser?.merchantId || MIRELLE_MERCHANT_ID;
      panelFallbackAuthToken ||
      await AuthTokenManager.get(user.authorizedAppId);

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
        },
        { status: 404 },
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

    const sourceRows = await prisma.$queryRaw<SourceRow[]>`
      select id, tenant_id, source_name
      from public.catalog_sources
      where source_name = ${IKAS_SOURCE_NAME}
        and is_active = true
      order by created_at desc
      limit 1
    `;

    const source = sourceRows[0];

    if (!source) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          runId: null,
          sourceName: IKAS_SOURCE_NAME,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'IKAS catalog source not found',
        },
        { status: 404 },
      );
    }

    const query = `
      query SyncProductsToQueueVariantPilot {
        listProduct {
          data {
            id
            name
            createdAt
            shortDescription
            description
            totalStock
            brand {
              name
            }
            categories {
              name
            }
           variants {
  id
  sku
  sellIfOutOfStock
  variantValues {
    variantTypeName
    variantValueName
  }
  prices {
    buyPrice
    discountPrice
    sellPrice
    priceListId
    currency
    currencyCode
    currencySymbol
  }
  stocks {
    id
    productId
    variantId
    stockLocationId
    stockCount
  }
}
          }
        }
      }
    `;

    const upstreamResponse = await fetch(config.graphApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + freshToken.accessToken,
      },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });

    const raw = await upstreamResponse.json();

    if (!upstreamResponse.ok || raw?.errors) {
  const upstreamError =
    raw?.errors?.[0]?.message ||
    raw?.errors?.[0]?.extensions?.code ||
    'Graph API request failed with status ' + upstreamResponse.status;

  const isLoginRequired =
    String(upstreamError).toUpperCase().includes('LOGIN_REQUIRED');

  return NextResponse.json(
    {
      ok: false,
      fetchedAt: new Date().toISOString(),
      runId: null,
      sourceName: source.source_name,
      queuedCount: 0,
      queuedExternalProductIds: [],
      error: isLoginRequired
        ? 'IKAS_LOGIN_REQUIRED_TOKEN_EXPIRED'
        : upstreamError,
      message: isLoginRequired
        ? 'ikas access token geçersiz veya süresi dolmuş. MIRELLE uygulamasının ikas içinde yeniden yetkilendirilmesi gerekiyor.'
        : undefined,
      tokenMerchantId: syncMerchantId,
tokenAuthorizedAppId: requestUser?.authorizedAppId || null,
tokenExpireDate: null,
tokenMode: 'client_credentials',
      upstreamError,
    },
    { status: isLoginRequired ? 401 : upstreamResponse.ok ? 500 : upstreamResponse.status },
  );
}

    const fetchedItems = Array.isArray(raw?.data?.listProduct?.data)
      ? raw.data.listProduct.data.slice(0, PRODUCT_LIMIT)
      : [];

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

        const variantsRaw = Array.isArray(item?.variants) ? item.variants : [];

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
                  return [typeName, valueName].filter(Boolean).join(': ');
                })
                .filter(Boolean)
                .join(' / ') || null;

            const sizeValue = getVariantOptionValue(variantValues, ['beden', 'size']);
const colorValue =
  getVariantOptionValue(variantValues, ['renk', 'color']) ||
  extractColorFromText(
    item?.name,
    optionSummary,
    variant?.sku,
  );
const prices = Array.isArray(variant?.prices) ? variant.prices : [];
const firstPrice = prices[0] || null;
const sellPrice =
  typeof firstPrice?.sellPrice === 'number' ? firstPrice.sellPrice : null;

const stocks = Array.isArray(variant?.stocks) ? variant.stocks : [];
const stockQty = stocks.reduce((sum: number, stock: any) => {
  const count = typeof stock?.stockCount === 'number' ? stock.stockCount : 0;
  return sum + count;
}, 0);

const stockStatus =
  stockQty > 0
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
  stock_qty: stockQty,
  stock_status: stockStatus,
  is_active: true,
  sell_if_out_of_stock: variant?.sellIfOutOfStock ?? null,
  stock_preview: stocks.slice(0, 10).map((stock: any) => ({
    stock_location_id: stock?.stockLocationId ?? null,
    stock_count: typeof stock?.stockCount === 'number' ? stock.stockCount : null,
  })),
};
          })
          .filter((variant: { id: string }) => !!variant.id);

        return {
          id: item?.id ?? '',
          brand: sourceBrandName,
          title: item?.name ?? '-',
          handle: slugify(item?.name) || item?.id || '',
          category: normalizedCategory,
          currency: 'TRY',
          variants: normalizedVariants,
          is_active: true,
          attributes: {
  source_platform: 'ikas',
  sync_origin: 'ikas_app',
  merchant_id: syncMerchantId,
  store_name: 'mirellestudio',
  source_category_name: firstCategoryName,
  source_brand_name: sourceBrandName,
  source_total_stock: totalStock,
  source_short_description_present: !!item?.shortDescription,
  source_description_present: !!item?.description,
  source_variant_count: normalizedVariants.length,
  source_variant_price_mode: 'sell_price_only',
  source_variant_stock_mode: 'stocks_sum',          
},
          base_price: null,
          description: item?.description ?? null,
          subcategory: null,
          stock_status:
            totalStock == null
              ? 'unknown'
              : totalStock > 0
                ? 'in_stock'
                : 'out_of_stock',
          short_description: item?.shortDescription ?? null,
          external_product_id: item?.id ?? '',
          created_at_source:
            item?.createdAt != null ? String(item.createdAt) : null,
        };
      })
      .filter((item: { id: string }) => !!item.id);

    if (!payloadItems.length) {
      return NextResponse.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        runId: null,
        sourceName: source.source_name,
        queuedCount: 0,
        queuedExternalProductIds: [],
        error: undefined,
      });
    }

    const transactionResult = await prisma.$transaction(async (tx) => {
      const runRows = await tx.$queryRaw<{ id: string }[]>`
        insert into public.catalog_sync_runs (
          tenant_id,
          catalog_source_id,
          sync_mode,
          status,
          started_at,
          finished_at,
          items_seen,
          items_created,
          items_updated,
          items_deactivated,
          error_count,
          notes,
          metadata
        )
        values (
          CAST(${source.tenant_id} AS uuid),
          CAST(${source.id} AS uuid),
          'manual',
          'success',
          now(),
          now(),
          ${payloadItems.length},
          0,
          0,
          0,
          0,
          'IKAS app queue write variant pilot',
          jsonb_build_object(
            'trigger', 'ikas_app_queue_variant_pilot',
            'source_name', ${source.source_name},
            'merchant_id', ${syncMerchantId},
            'queued_count', ${payloadItems.length},
            'product_limit', ${PRODUCT_LIMIT}
          )
        )
        returning id
      `;

      const runId = runRows[0]?.id;

      if (!runId) {
        throw new Error('Failed to create catalog sync run');
      }

      for (const item of payloadItems) {
        await tx.$executeRaw`
          insert into public.catalog_sync_raw_items (
            tenant_id,
            catalog_source_id,
            catalog_sync_run_id,
            external_product_id,
            item_type,
            processed_status,
            payload_json
          )
          values (
            CAST(${source.tenant_id} AS uuid),
            CAST(${source.id} AS uuid),
            CAST(${runId} AS uuid),
            ${item.id},
            'product',
            'pending',
            CAST(${JSON.stringify(item)} AS jsonb)
          )
        `;
      }

      return {
        runId,
      };
    });

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      runId: transactionResult.runId,
      sourceName: source.source_name,
      queuedCount: payloadItems.length,
      queuedExternalProductIds: payloadItems.map((item: { id: string }) => item.id),
      error: undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        runId: null,
        sourceName: IKAS_SOURCE_NAME,
        queuedCount: 0,
        queuedExternalProductIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
