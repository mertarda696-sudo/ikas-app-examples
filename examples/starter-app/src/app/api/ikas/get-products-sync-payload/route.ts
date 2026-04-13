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
              variantValues {
                variantTypeName
                variantValueName
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
        variantsPreview: variants.slice(0, 10).map((variant: any) => ({
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
        })),
      };
    });

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      itemCount: items.length,
      items,
      variantAuditMode,
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
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
