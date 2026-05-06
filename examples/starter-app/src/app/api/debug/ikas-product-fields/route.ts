import { onCheckToken } from '@/helpers/api-helpers';
import { config } from '@/globals/config';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

type GraphQLTypeRef = {
  kind?: string | null;
  name?: string | null;
  ofType?: GraphQLTypeRef | null;
};

type GraphQLField = {
  name: string;
  type?: GraphQLTypeRef | null;
};

const DEBUG_SECRET_FALLBACK = 'mirelle-debug-2026';
const TARGET_PRODUCT_NAME = 'Test Ceket Kahverengi';
const KEYWORD_PATTERN =
  /(active|status|sales|channel|visible|visibility|publish|published|store|storefront|delete|deleted|enabled|available|availability|id|name)/i;

function unwrapTypeName(type?: GraphQLTypeRef | null): string | null {
  let cursor = type;

  while (cursor) {
    if (cursor.name) return cursor.name;
    cursor = cursor.ofType || null;
  }

  return null;
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
}

function isSelectableLeaf(typeName: string | null) {
  if (!typeName) return false;
  return (
    ['String', 'Boolean', 'Int', 'Float', 'ID'].includes(typeName) ||
    typeName.endsWith('Enum')
  );
}

function serializeFields(fields: GraphQLField[]) {
  return fields.map((field) => ({
    name: field.name,
    typeName: unwrapTypeName(field.type),
    rawType: field.type,
  }));
}

function pickCandidateFields(fields: GraphQLField[]) {
  return serializeFields(fields).filter((field) => KEYWORD_PATTERN.test(field.name));
}

function pickSelectableFieldNames(fields: GraphQLField[]) {
  return serializeFields(fields)
    .filter((field) => isSelectableLeaf(field.typeName))
    .map((field) => field.name);
}

async function ikasGraphQL<T>(accessToken: string, query: string): Promise<T> {
  if (!config.graphApiUrl) {
    throw new Error('Graph API URL not configured');
  }

  const response = await fetch(config.graphApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  });

  const body = await response.json();

  if (!response.ok || body?.errors) {
    throw new Error(
      body?.errors?.[0]?.message ||
        body?.errors?.[0]?.extensions?.code ||
        'GraphQL request failed with status ' + response.status,
    );
  }

  return body as T;
}

async function getIkasAccessToken() {
  const tokens = await AuthTokenManager.list();
  const token = tokens.find((item) => !item.deleted && item.accessToken);

  if (!token) {
    throw new Error('No stored ikas auth token found');
  }

  const refreshedTokenResult = await onCheckToken(token);
  return refreshedTokenResult.accessToken || token.accessToken;
}

export async function GET(request: NextRequest) {
  const secretFromRequest = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.IKAS_DEBUG_SECRET || DEBUG_SECRET_FALLBACK;

  if (secretFromRequest !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized debug request' },
      { status: 401 },
    );
  }

  try {
    const accessToken = await getIkasAccessToken();

    const introspectionQuery = `
      query IkasProductFieldIntrospection {
        productType: __type(name: "Product") {
          fields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
        productVariantType: __type(name: "ProductVariant") {
          fields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
        productSalesChannelType: __type(name: "ProductSalesChannel") {
          fields {
            name
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    `;

    const introspection = await ikasGraphQL<any>(accessToken, introspectionQuery);

    const productFields: GraphQLField[] = introspection?.data?.productType?.fields || [];
    const variantFields: GraphQLField[] = introspection?.data?.productVariantType?.fields || [];
    const productSalesChannelFields: GraphQLField[] =
      introspection?.data?.productSalesChannelType?.fields || [];

    const productCandidateFields = pickCandidateFields(productFields);
    const variantCandidateFields = pickCandidateFields(variantFields);
    const productSalesChannelCandidateFields = pickCandidateFields(productSalesChannelFields);

    const safeProductSelections = pickSelectableFieldNames(productFields)
      .filter((name) => KEYWORD_PATTERN.test(name))
      .join('\n');

    const safeVariantSelections = pickSelectableFieldNames(variantFields)
      .filter((name) => KEYWORD_PATTERN.test(name))
      .join('\n');

    const salesChannelSelectableFieldNames = pickSelectableFieldNames(productSalesChannelFields);
    const safeSalesChannelSelections = salesChannelSelectableFieldNames.join('\n');

    const salesChannelsBlock = safeSalesChannelSelections
      ? `salesChannels {
              ${safeSalesChannelSelections}
            }`
      : '';

    const productQuery = `
      query IkasProductVisibilityDebug {
        listProduct {
          data {
            id
            name
            totalStock
            ${safeProductSelections}
            ${salesChannelsBlock}
            categories {
              name
            }
            variants {
              id
              sku
              sellIfOutOfStock
              ${safeVariantSelections}
              variantValues {
                variantTypeName
                variantValueName
              }
              prices {
                sellPrice
                currencyCode
              }
              stocks {
                stockLocationId
                stockCount
              }
            }
          }
        }
      }
    `;

    let productDebug: any = null;
    let productQueryError: string | null = null;

    try {
      productDebug = await ikasGraphQL<any>(accessToken, productQuery);
    } catch (error) {
      productQueryError = error instanceof Error ? error.message : 'Unknown product query error';
    }

    const allProducts = Array.isArray(productDebug?.data?.listProduct?.data)
      ? productDebug.data.listProduct.data
      : [];

    const targetProduct = allProducts.find((product: any) =>
      normalizeText(product?.name).includes(normalizeText(TARGET_PRODUCT_NAME)),
    );

    return NextResponse.json({
      ok: true,
      debugTarget: TARGET_PRODUCT_NAME,
      productFieldCount: productFields.length,
      variantFieldCount: variantFields.length,
      productSalesChannelFieldCount: productSalesChannelFields.length,
      productCandidateFields,
      variantCandidateFields,
      productSalesChannelFields: serializeFields(productSalesChannelFields),
      productSalesChannelCandidateFields,
      salesChannelSelectableFieldNames,
      productQueryError,
      productCount: allProducts.length,
      productNames: allProducts.map((product: any) => product?.name).filter(Boolean),
      targetProduct: targetProduct || null,
      generatedProductQuery: productQuery,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown debug error',
      },
      { status: 500 },
    );
  }
}
