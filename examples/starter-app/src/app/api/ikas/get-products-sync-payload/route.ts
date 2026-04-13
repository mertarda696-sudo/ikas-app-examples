import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { config } from '@/globals/config';
import { NextRequest, NextResponse } from 'next/server';

type GraphResponse = {
  ok: boolean;
  status: number;
  raw: any;
};

type SchemaTypePreview = {
  typeName: string;
  fieldNames: string[];
  matchedStockFields?: string[];
};

const STOCK_FIELD_REGEX =
  /(stock|stocks|quantity|inventory|available|availablestock|totalstock)/i;

const EXCLUDED_TYPE_REGEX =
  /(input|orderline|shipping|subscription|payment|gift|cargo|create|update|bulk|add)/i;

async function callGraphApi(
  query: string,
  accessToken: string,
): Promise<GraphResponse> {
  const response = await fetch(config.graphApiUrl as string, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  });

  const raw = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    raw,
  };
}

function uniqStrings(values: string[]) {
  return values.filter((value, index, arr) => !!value && arr.indexOf(value) === index);
}

function toFieldNames(fields: any) {
  return Array.isArray(fields)
    ? fields.map((field: any) => String(field?.name || '')).filter(Boolean)
    : [];
}

function getVariantSchemaPriority(typeName: string, fieldNames: string[]) {
  const lowerTypeName = typeName.toLowerCase();
  const lowerFields = fieldNames.map((field) => field.toLowerCase());

  let priority = 0;

  if (lowerTypeName === 'simpleproductvariant') priority += 200;
  if (lowerTypeName === 'productprice') priority += 180;
  if (lowerTypeName.includes('productvariant')) priority += 120;
  if (lowerTypeName.includes('variantprice')) priority += 100;
  if (lowerTypeName.includes('inventory')) priority += 90;
  if (lowerTypeName.includes('stock')) priority += 80;
  if (lowerTypeName.includes('available')) priority += 75;
  if (lowerTypeName.includes('barcode')) priority += 70;

  if (lowerFields.includes('sellprice')) priority += 30;
  if (lowerFields.includes('buyprice')) priority += 30;
  if (lowerFields.includes('discountprice')) priority += 30;
  if (lowerFields.includes('prices')) priority += 25;
  if (lowerFields.includes('stocks')) priority += 25;
  if (lowerFields.includes('price')) priority += 20;
  if (lowerFields.includes('stock')) priority += 20;
  if (lowerFields.includes('quantity')) priority += 20;
  if (lowerFields.includes('inventory')) priority += 20;
  if (lowerFields.includes('available')) priority += 20;
  if (lowerFields.includes('totalstock')) priority += 20;
  if (lowerFields.includes('barcode')) priority += 10;
  if (lowerFields.includes('sku')) priority += 10;
  if (lowerFields.includes('variantvalues')) priority += 10;

  return priority;
}

function getStockSchemaPriority(typeName: string, fieldNames: string[]) {
  const lowerTypeName = typeName.toLowerCase();
  const lowerFields = fieldNames.map((field) => field.toLowerCase());

  let priority = 0;

  if (lowerTypeName === 'simpleproductvariant') priority += 220;
  if (lowerTypeName.includes('inventory')) priority += 180;
  if (lowerTypeName.includes('stock')) priority += 170;
  if (lowerTypeName.includes('available')) priority += 160;
  if (lowerTypeName.includes('productvariant')) priority += 120;

  if (lowerFields.includes('stock')) priority += 50;
  if (lowerFields.includes('stocks')) priority += 50;
  if (lowerFields.includes('quantity')) priority += 45;
  if (lowerFields.includes('inventory')) priority += 45;
  if (lowerFields.includes('available')) priority += 45;
  if (lowerFields.includes('availablestock')) priority += 45;
  if (lowerFields.includes('totalstock')) priority += 45;

  return priority;
}

function buildVariantSchemaTypes(allTypes: any[]): SchemaTypePreview[] {
  return allTypes
    .map((type: any) => {
      const typeName = String(type?.name || '');
      const fieldNames = toFieldNames(type?.fields);
      const lowerTypeName = typeName.toLowerCase();
      const lowerFields = fieldNames.map((field) => field.toLowerCase());

      const hasTargetTypeName =
        lowerTypeName.includes('productvariant') ||
        lowerTypeName.includes('variantprice') ||
        lowerTypeName.includes('productprice') ||
        lowerTypeName.includes('inventory') ||
        lowerTypeName.includes('stock') ||
        lowerTypeName.includes('available') ||
        lowerTypeName.includes('barcode');

      const hasTargetFieldName =
        lowerFields.includes('sku') ||
        lowerFields.includes('price') ||
        lowerFields.includes('prices') ||
        lowerFields.includes('sellprice') ||
        lowerFields.includes('buyprice') ||
        lowerFields.includes('discountprice') ||
        lowerFields.includes('stock') ||
        lowerFields.includes('stocks') ||
        lowerFields.includes('quantity') ||
        lowerFields.includes('totalstock') ||
        lowerFields.includes('inventory') ||
        lowerFields.includes('available') ||
        lowerFields.includes('availablestock') ||
        lowerFields.includes('barcode') ||
        lowerFields.includes('variantvalues');

      return {
        typeName,
        fieldNames,
        hasTargetTypeName,
        hasTargetFieldName,
        isExcluded: EXCLUDED_TYPE_REGEX.test(lowerTypeName),
      };
    })
    .filter((type: any) => {
      return (type.hasTargetTypeName || type.hasTargetFieldName) && !type.isExcluded;
    })
    .sort((a: any, b: any) => {
      const diff =
        getVariantSchemaPriority(b.typeName, b.fieldNames) -
        getVariantSchemaPriority(a.typeName, a.fieldNames);

      if (diff !== 0) return diff;
      return a.typeName.localeCompare(b.typeName);
    })
    .slice(0, 20)
    .map((type: any) => ({
      typeName: type.typeName,
      fieldNames: type.fieldNames,
    }));
}

function buildStockSchemaTypes(allTypes: any[]): SchemaTypePreview[] {
  return allTypes
    .map((type: any) => {
      const typeName = String(type?.name || '');
      const fieldNames = toFieldNames(type?.fields);
      const lowerTypeName = typeName.toLowerCase();

      const matchedStockFields = fieldNames.filter((field) =>
        STOCK_FIELD_REGEX.test(field),
      );

      const isStockRelevantType =
        lowerTypeName.includes('productvariant') ||
        lowerTypeName.includes('inventory') ||
        lowerTypeName.includes('stock') ||
        lowerTypeName.includes('available') ||
        matchedStockFields.length > 0;

      return {
        typeName,
        fieldNames,
        matchedStockFields,
        isStockRelevantType,
        isExcluded: EXCLUDED_TYPE_REGEX.test(lowerTypeName),
      };
    })
    .filter((type: any) => type.isStockRelevantType && !type.isExcluded)
    .sort((a: any, b: any) => {
      const diff =
        getStockSchemaPriority(b.typeName, b.fieldNames) -
        getStockSchemaPriority(a.typeName, a.fieldNames);

      if (diff !== 0) return diff;
      return a.typeName.localeCompare(b.typeName);
    })
    .slice(0, 20)
    .map((type: any) => ({
      typeName: type.typeName,
      fieldNames: type.fieldNames,
      matchedStockFields: type.matchedStockFields,
    }));
}

function buildVariantDirectStockFields(allTypes: any[]) {
  const fields = allTypes
    .filter((type: any) => {
      const lowerTypeName = String(type?.name || '').toLowerCase();
      return lowerTypeName.includes('productvariant');
    })
    .flatMap((type: any) => toFieldNames(type?.fields))
    .filter((field: string) => STOCK_FIELD_REGEX.test(field));

  return uniqStrings(fields).sort((a, b) => a.localeCompare(b));
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          itemCount: 0,
          items: [],
          variantAuditMode: 'unauthorized',
          schemaAuditMode: 'not_run',
          stockAuditMode: 'not_run',
          variantSchemaTypes: [],
          stockSchemaTypes: [],
          variantDirectStockFields: [],
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);

    if (!authToken?.accessToken) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          itemCount: 0,
          items: [],
          variantAuditMode: 'no_token',
          schemaAuditMode: 'not_run',
          stockAuditMode: 'not_run',
          variantSchemaTypes: [],
          stockSchemaTypes: [],
          variantDirectStockFields: [],
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
          itemCount: 0,
          items: [],
          variantAuditMode: 'no_graph_url',
          schemaAuditMode: 'not_run',
          stockAuditMode: 'not_run',
          variantSchemaTypes: [],
          stockSchemaTypes: [],
          variantDirectStockFields: [],
          error: 'Graph API URL not configured',
        },
        { status: 500 },
      );
    }

    const preferredQuery = `
      query ProductsSyncPayloadAudit {
        listProduct {
          data {
            id
            name
            createdAt
            description
            shortDescription
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

    const fallbackQuery = `
      query ProductsSyncPayloadAuditFallback {
        listProduct {
          data {
            id
            name
            createdAt
            description
            shortDescription
            totalStock
            brand {
              name
            }
            categories {
              name
            }
          }
        }
      }
    `;

    const introspectionQuery = `
      query VariantSchemaAudit {
        __schema {
          types {
            name
            fields {
              name
            }
          }
        }
      }
    `;

    let variantAuditMode: 'variant_full' | 'variant_fallback' = 'variant_full';
    let preferredErrorMessage: string | null = null;

    let graphResult = await callGraphApi(preferredQuery, authToken.accessToken);

    if (!graphResult.ok || graphResult.raw?.errors) {
      preferredErrorMessage =
        graphResult.raw?.errors?.[0]?.message ||
        'Preferred variant audit query failed with status ' + graphResult.status;

      variantAuditMode = 'variant_fallback';
      graphResult = await callGraphApi(fallbackQuery, authToken.accessToken);
    }

    if (!graphResult.ok || graphResult.raw?.errors) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          itemCount: 0,
          items: [],
          variantAuditMode,
          schemaAuditMode: 'not_run',
          stockAuditMode: 'not_run',
          variantSchemaTypes: [],
          stockSchemaTypes: [],
          variantDirectStockFields: [],
          error:
            graphResult.raw?.errors?.[0]?.message ||
            'Graph API request failed with status ' + graphResult.status,
        },
        { status: graphResult.ok ? 500 : graphResult.status },
      );
    }

    const products = Array.isArray(graphResult.raw?.data?.listProduct?.data)
      ? graphResult.raw.data.listProduct.data.slice(0, 5)
      : [];

    const items = products.map((item: any) => {
      const firstCategoryName =
        Array.isArray(item?.categories) && item.categories.length
          ? item.categories[0]?.name || null
          : null;

      const variants = Array.isArray(item?.variants) ? item.variants : [];

      return {
        externalProductId: item?.id ?? '',
        title: item?.name ?? '-',
        createdAt: item?.createdAt != null ? String(item.createdAt) : null,
        brandName: item?.brand?.name ?? null,
        categoryName: firstCategoryName,
        totalStock:
          typeof item?.totalStock === 'number' ? item.totalStock : null,
        shortDescription: item?.shortDescription ?? null,
        description: item?.description ?? null,
        itemType: 'product',
        variantCount: variants.length,
        variantsPreview: variants.slice(0, 10).map((variant: any) => {
  const prices = Array.isArray(variant?.prices) ? variant.prices : [];
  const firstPrice = prices[0] || null;

  const stocks = Array.isArray(variant?.stocks) ? variant.stocks : [];
  const stockTotal = stocks.reduce((sum: number, stock: any) => {
    const count = typeof stock?.stockCount === 'number' ? stock.stockCount : 0;
    return sum + count;
  }, 0);

  return {
    externalVariantId: variant?.id ?? '',
    sku: variant?.sku ?? null,
    optionSummary: Array.isArray(variant?.variantValues)
      ? variant.variantValues
          .map((value: any) => {
            const typeName = value?.variantTypeName ?? '';
            const valueName = value?.variantValueName ?? '';
            return [typeName, valueName].filter(Boolean).join(': ');
          })
          .filter(Boolean)
          .join(' / ')
      : null,
    buyPrice: firstPrice?.buyPrice ?? null,
    sellPrice: firstPrice?.sellPrice ?? null,
    discountPrice: firstPrice?.discountPrice ?? null,
    priceCurrency:
      firstPrice?.currencySymbol ??
      firstPrice?.currencyCode ??
      firstPrice?.currency ??
      null,
    sellIfOutOfStock: variant?.sellIfOutOfStock ?? null,
    stockTotal,
    stockPreview: stocks.slice(0, 10).map((stock: any) => ({
      stockLocationId: stock?.stockLocationId ?? null,
      stockCount: typeof stock?.stockCount === 'number' ? stock.stockCount : null,
    })),
  };
}),
      };
    });

    let schemaAuditMode: 'introspection_ok' | 'introspection_failed' =
      'introspection_failed';
    let stockAuditMode: 'schema_only' | 'schema_not_available' =
      'schema_not_available';
    let variantSchemaTypes: SchemaTypePreview[] = [];
    let stockSchemaTypes: SchemaTypePreview[] = [];
    let variantDirectStockFields: string[] = [];

    const schemaResult = await callGraphApi(introspectionQuery, authToken.accessToken);

    if (schemaResult.ok && !schemaResult.raw?.errors) {
      const allTypes = Array.isArray(schemaResult.raw?.data?.__schema?.types)
        ? schemaResult.raw.data.__schema.types
        : [];

      variantSchemaTypes = buildVariantSchemaTypes(allTypes);
      stockSchemaTypes = buildStockSchemaTypes(allTypes);
      variantDirectStockFields = buildVariantDirectStockFields(allTypes);

      schemaAuditMode = 'introspection_ok';
      stockAuditMode = 'schema_only';
    }

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
      variantAuditMode,
      schemaAuditMode,
      stockAuditMode,
      variantSchemaTypes,
      stockSchemaTypes,
      variantDirectStockFields,
      error: variantAuditMode === 'variant_fallback' ? preferredErrorMessage : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        itemCount: 0,
        items: [],
        variantAuditMode: 'runtime_error',
        schemaAuditMode: 'runtime_error',
        stockAuditMode: 'runtime_error',
        variantSchemaTypes: [],
        stockSchemaTypes: [],
        variantDirectStockFields: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
