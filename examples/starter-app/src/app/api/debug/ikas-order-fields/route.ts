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
      query IkasOrderTypeDiscovery {
        queryType: __type(name: "Query") {
          fields {
            name
            args {
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
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
            type {
              kind
              name
              ofType {
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
        orderPaginationResponse: __type(name: "OrderPaginationResponse") {
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
        order: __type(name: "Order") {
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
        orderCustomer: __type(name: "OrderCustomer") {
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
        orderLineItem: __type(name: "OrderLineItem") {
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
        orderPackage: __type(name: "OrderPackage") {
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
        orderShippingLine: __type(name: "OrderShippingLine") {
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
        orderPaymentMethod: __type(name: "OrderPaymentMethod") {
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
        orderAddress: __type(name: "OrderAddress") {
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

    const queryFields: GraphQLField[] = introspection?.data?.queryType?.fields || [];
    const listOrderField = serializeFields(queryFields).find((field) => field.name === 'listOrder') || null;

    return NextResponse.json({
      ok: true,
      listOrderField,
      orderPaginationResponseFields: serializeFields(
        introspection?.data?.orderPaginationResponse?.fields || [],
      ),
      orderFields: serializeFields(introspection?.data?.order?.fields || []),
      orderCustomerFields: serializeFields(introspection?.data?.orderCustomer?.fields || []),
      orderLineItemFields: serializeFields(introspection?.data?.orderLineItem?.fields || []),
      orderPackageFields: serializeFields(introspection?.data?.orderPackage?.fields || []),
      orderShippingLineFields: serializeFields(introspection?.data?.orderShippingLine?.fields || []),
      orderPaymentMethodFields: serializeFields(introspection?.data?.orderPaymentMethod?.fields || []),
      orderAddressFields: serializeFields(introspection?.data?.orderAddress?.fields || []),
      hint: 'Next step: build a tiny listOrder sample query using only verified scalar and object fields.',
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
