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
  args?: Array<{
    name: string;
    type?: GraphQLTypeRef | null;
  }> | null;
};

const DEBUG_SECRET_FALLBACK = 'mirelle-debug-2026';

function unwrapTypeName(type?: GraphQLTypeRef | null): string | null {
  let cursor = type;

  while (cursor) {
    if (cursor.name) return cursor.name;
    cursor = cursor.ofType || null;
  }

  return null;
}

function serializeTypeRef(type?: GraphQLTypeRef | null): unknown {
  if (!type) return null;

  return {
    kind: type.kind || null,
    name: type.name || null,
    ofType: type.ofType ? serializeTypeRef(type.ofType) : null,
  };
}

function serializeFields(fields: GraphQLField[]) {
  return fields.map((field) => ({
    name: field.name,
    typeName: unwrapTypeName(field.type),
    rawType: serializeTypeRef(field.type),
    args: (field.args || []).map((arg) => ({
      name: arg.name,
      typeName: unwrapTypeName(arg.type),
      rawType: serializeTypeRef(arg.type),
    })),
  }));
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
      query IkasOrderNestedFieldDiscovery {
        orderLineVariant: __type(name: "OrderLineVariant") {
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
        orderLineOption: __type(name: "OrderLineOption") {
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
        orderLineOptionValue: __type(name: "OrderLineOptionValue") {
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
        trackingInfo: __type(name: "TrackingInfo") {
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
        orderSalesChannel: __type(name: "OrderSalesChannel") {
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

    const sampleOrderQuery = `
      query IkasOrderSample {
        listOrder(pagination: { page: 1, limit: 3 }, sort: "orderedAt:desc") {
          count
          hasNext
          page
          limit
          data {
            id
            orderNumber
            status
            orderPaymentStatus
            orderPackageStatus
            orderedAt
            createdAt
            updatedAt
            cancelledAt
            currencyCode
            totalPrice
            totalFinalPrice
            itemCount
            customerId
            customer {
              id
              fullName
              firstName
              lastName
              email
              phone
              isGuestCheckout
            }
            paymentMethods {
              type
              paymentGatewayName
              paymentGatewayCode
              price
            }
            shippingLines {
              title
              price
              finalPrice
              cargoCompanyId
              paymentMethod
            }
            orderLineItems {
              id
              quantity
              price
              unitPrice
              finalPrice
              finalUnitPrice
              discountPrice
              currencyCode
              status
              sourceId
              stockLocationId
              variant {
                id
                name
                sku
              }
              options {
                name
                values {
                  name
                }
              }
            }
            orderPackages {
              id
              orderPackageNumber
              orderPackageFulfillStatus
              sourceId
              trackingInfo {
                trackingNumber
                trackingLink
                cargoCompany
              }
            }
          }
        }
      }
    `;

    let sampleOrderResponse: unknown = null;
    let sampleOrderError: string | null = null;

    try {
      sampleOrderResponse = await ikasGraphQL<any>(accessToken, sampleOrderQuery);
    } catch (error) {
      sampleOrderError = error instanceof Error ? error.message : 'Unknown sample order query error';
    }

    return NextResponse.json({
      ok: true,
      orderLineVariantFields: serializeFields(introspection?.data?.orderLineVariant?.fields || []),
      orderLineOptionFields: serializeFields(introspection?.data?.orderLineOption?.fields || []),
      orderLineOptionValueFields: serializeFields(introspection?.data?.orderLineOptionValue?.fields || []),
      trackingInfoFields: serializeFields(introspection?.data?.trackingInfo?.fields || []),
      orderSalesChannelFields: serializeFields(introspection?.data?.orderSalesChannel?.fields || []),
      sampleOrderError,
      sampleOrderResponse,
      generatedSampleOrderQuery: sampleOrderQuery,
      hint: 'If sampleOrderError is not null, use nested fields above to remove invalid fields from sampleOrderQuery.',
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
