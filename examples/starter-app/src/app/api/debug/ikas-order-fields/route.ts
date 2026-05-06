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
const ORDER_KEYWORD_PATTERN = /(order|orders|sale|sales|checkout|cart|customer|fulfillment|shipping|payment|transaction|invoice|cargo|shipment|package|line|item)/i;

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

function pickOrderRelatedFields(fields: GraphQLField[]) {
  return serializeFields(fields).filter((field) =>
    ORDER_KEYWORD_PATTERN.test(field.name) ||
    ORDER_KEYWORD_PATTERN.test(field.typeName || '') ||
    field.args.some((arg) => ORDER_KEYWORD_PATTERN.test(arg.name) || ORDER_KEYWORD_PATTERN.test(arg.typeName || '')),
  );
}

function pickOrderRelatedTypes(types: Array<{ name?: string | null; kind?: string | null }>) {
  return types
    .filter((type) => type.name && ORDER_KEYWORD_PATTERN.test(type.name))
    .map((type) => ({ name: type.name, kind: type.kind }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
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
      query IkasOrderFieldDiscovery {
        schema: __schema {
          types {
            kind
            name
          }
        }
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
      }
    `;

    const introspection = await ikasGraphQL<any>(accessToken, introspectionQuery);

    const queryFields: GraphQLField[] = introspection?.data?.queryType?.fields || [];
    const schemaTypes: Array<{ name?: string | null; kind?: string | null }> =
      introspection?.data?.schema?.types || [];

    const orderRelatedQueryFields = pickOrderRelatedFields(queryFields);
    const orderRelatedTypes = pickOrderRelatedTypes(schemaTypes);

    return NextResponse.json({
      ok: true,
      queryFieldCount: queryFields.length,
      orderRelatedQueryFields,
      orderRelatedTypes,
      hint: 'Next step: use orderRelatedQueryFields to choose the correct ikas order list query, then inspect that return type fields.',
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
