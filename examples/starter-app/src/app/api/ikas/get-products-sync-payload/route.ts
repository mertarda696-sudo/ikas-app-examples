import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { config } from '@/globals/config';
import { NextRequest, NextResponse } from 'next/server';

type GraphResponse = {
  ok: boolean;
  status: number;
  raw: any;
};

async function callGraphApi(query: string, accessToken: string): Promise<GraphResponse> {
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
          variantSchemaTypes: [],
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
          variantSchemaTypes: [],
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
          variantSchemaTypes: [],
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
              barcodeList
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
                stock
                stockLocationId
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
          variantSchemaTypes: [],
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
          const firstStock = stocks[0] || null;

          const barcodeList = Array.isArray(variant?.barcodeList) ? variant.barcodeList : [];

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
            stockValue: firstStock?.stock ?? null,
            stockLocationId: firstStock?.stockLocationId ?? null,
            barcodePreview: barcodeList.length ? barcodeList.join(', ') : null,
          };
        }),
      };
    });

    let schemaAuditMode: 'introspection_ok' | 'introspection_failed' = 'introspection_failed';
    let variantSchemaTypes: Array<{ typeName: string; fieldNames: string[] }> = [];

    const schemaResult = await callGraphApi(introspectionQuery, authToken.accessToken);

    if (schemaResult.ok && !schemaResult.raw?.errors) {
      const allTypes = Array.isArray(schemaResult.raw?.data?.__schema?.types)
        ? schemaResult.raw.data.__schema.types
        : [];

      const filteredTypes = allTypes
        .map((type: any) => {
          const fieldNames = Array.isArray(type?.fields)
            ? type.fields.map((field: any) => field?.name).filter(Boolean)
            : [];

          const lowerTypeName = String(type?.name || '').toLowerCase();
          const lowerFields = fieldNames.map((field: string) => String(field).toLowerCase());

          const hasTargetTypeName =
            lowerTypeName.includes('productvariant') ||
            lowerTypeName.includes('variantprice') ||
            lowerTypeName.includes('productprice') ||
            lowerTypeName.includes('inventory') ||
            lowerTypeName.includes('stock') ||
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
            lowerFields.includes('barcode') ||
            lowerFields.includes('variantvalues');

          const hasExcludedTypeName =
            lowerTypeName.endsWith('input') ||
            lowerTypeName.includes('orderline') ||
            lowerTypeName.includes('shipping') ||
            lowerTypeName.includes('subscription') ||
            lowerTypeName.includes('payment') ||
            lowerTypeName.includes('gift') ||
            lowerTypeName.includes('cargo') ||
            lowerTypeName.includes('available') ||
            lowerTypeName.includes('create') ||
            lowerTypeName.includes('update') ||
            lowerTypeName.includes('bulk') ||
            lowerTypeName.includes('add');

          let priority = 0;

          if (lowerTypeName === 'simpleproductvariant') priority += 200;
          if (lowerTypeName === 'productprice') priority += 180;
          if (lowerTypeName.includes('productvariant')) priority += 120;
          if (lowerTypeName.includes('variantprice')) priority += 100;
          if (lowerTypeName.includes('inventory')) priority += 90;
          if (lowerTypeName.includes('stock')) priority += 80;
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
          if (lowerFields.includes('barcode')) priority += 10;
          if (lowerFields.includes('sku')) priority += 10;
          if (lowerFields.includes('variantvalues')) priority += 10;

          return {
            typeName: type?.name ?? '',
            fieldNames,
            hasTargetTypeName,
            hasTargetFieldName,
            hasExcludedTypeName,
            priority,
          };
        })
        .filter((type: {
          hasTargetTypeName: boolean;
          hasTargetFieldName: boolean;
          hasExcludedTypeName: boolean;
        }) => {
          return (type.hasTargetTypeName || type.hasTargetFieldName) && !type.hasExcludedTypeName;
        })
        .sort((a: { priority: number; typeName: string }, b: { priority: number; typeName: string }) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return a.typeName.localeCompare(b.typeName);
        })
        .slice(0, 20)
        .map((type: { typeName: string; fieldNames: string[] }) => ({
          typeName: type.typeName,
          fieldNames: type.fieldNames,
        }));

      variantSchemaTypes = filteredTypes;
      schemaAuditMode = 'introspection_ok';
    }

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
      variantAuditMode,
      schemaAuditMode,
      variantSchemaTypes,
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
        variantSchemaTypes: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
