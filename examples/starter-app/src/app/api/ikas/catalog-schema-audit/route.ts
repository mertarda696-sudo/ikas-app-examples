import { NextRequest, NextResponse } from 'next/server';

import { config } from '@/globals/config';
import {
  isIkasTokenRefreshDue,
  onCheckToken,
} from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';

type GraphTypeRef = {
  kind?: string | null;
  name?: string | null;
  ofType?: GraphTypeRef | null;
};

type GraphArgument = {
  name?: string | null;
  defaultValue?: string | null;
  type?: GraphTypeRef | null;
};

type GraphField = {
  name?: string | null;
  args?: GraphArgument[] | null;
  type?: GraphTypeRef | null;
};

type GraphSchemaType = {
  kind?: string | null;
  name?: string | null;
  inputFields?: GraphArgument[] | null;
  fields?: GraphField[] | null;
};

function unwrapNamedType(type?: GraphTypeRef | null): {
  typeName: string | null;
  typeKind: string | null;
  isRequired: boolean;
  isList: boolean;
} {
  let cursor = type ?? null;
  let isRequired = false;
  let isList = false;

  if (cursor?.kind === 'NON_NULL') {
    isRequired = true;
    cursor = cursor.ofType ?? null;
  }

  if (cursor?.kind === 'LIST') {
    isList = true;
    cursor = cursor.ofType ?? null;

    if (cursor?.kind === 'NON_NULL') {
      cursor = cursor.ofType ?? null;
    }
  }

  while (cursor && !cursor.name && cursor.ofType) {
    cursor = cursor.ofType;
  }

  return {
    typeName: cursor?.name ?? null,
    typeKind: cursor?.kind ?? null,
    isRequired,
    isList,
  };
}

function normalizeFieldContract(field?: GraphField | null) {
  if (!field) return null;

  const returnType = unwrapNamedType(field.type);

  return {
    name: field.name ?? null,
    returnType,
    args: Array.isArray(field.args)
      ? field.args.map((arg) => ({
          name: arg?.name ?? null,
          defaultValue: arg?.defaultValue ?? null,
          ...unwrapNamedType(arg?.type),
        }))
      : [],
  };
}

function normalizeInputType(type?: GraphSchemaType | null) {
  if (!type) return null;

  return {
    name: type.name ?? null,
    kind: type.kind ?? null,
    fields: Array.isArray(type.inputFields)
      ? type.inputFields.map((field) => ({
          name: field?.name ?? null,
          defaultValue: field?.defaultValue ?? null,
          ...unwrapNamedType(field?.type),
        }))
      : [],
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
          auditVersion: 'g3_c2a_ikas_catalog_schema_v1',
          mutationPerformed: false,
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    const merchantId = String(user.merchantId ?? '').trim();
    const authorizedAppId = String(user.authorizedAppId ?? '').trim();

    if (!merchantId || !authorizedAppId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          auditVersion: 'g3_c2a_ikas_catalog_schema_v1',
          mutationPerformed: false,
          error: 'IKAS_IDENTITY_CONTRACT_INCOMPLETE',
        },
        { status: 400 },
      );
    }

    const authToken = await AuthTokenManager.getActiveByIdentity({
      authorizedAppId,
      merchantId,
    });

    if (!authToken?.accessToken) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          auditVersion: 'g3_c2a_ikas_catalog_schema_v1',
          mutationPerformed: false,
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
          auditVersion: 'g3_c2a_ikas_catalog_schema_v1',
          mutationPerformed: false,
          error: 'Graph API URL not configured',
        },
        { status: 500 },
      );
    }

    const tokenRefreshDue = isIkasTokenRefreshDue(authToken);
    const refreshedTokenResult = await onCheckToken(authToken);
    const accessToken =
      refreshedTokenResult.accessToken ||
      (!tokenRefreshDue ? authToken.accessToken : null);

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          auditVersion: 'g3_c2a_ikas_catalog_schema_v1',
          mutationPerformed: false,
          error: 'IKAS_TOKEN_REFRESH_FAILED',
        },
        { status: 401 },
      );
    }

    const introspectionQuery = `
      query G3CatalogPaginationSchemaAudit {
        __schema {
          queryType {
            fields(includeDeprecated: true) {
              name
              args {
                name
                defaultValue
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
          types {
            kind
            name
            inputFields {
              name
              defaultValue
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
            fields(includeDeprecated: true) {
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
          }
        }
      }
    `;

    const response = await fetch(config.graphApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ query: introspectionQuery }),
      cache: 'no-store',
    });

    const raw = await response.json();

    if (!response.ok || raw?.errors) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          auditVersion: 'g3_c2a_ikas_catalog_schema_v1',
          mutationPerformed: false,
          error:
            raw?.errors?.[0]?.message ||
            'GraphQL introspection failed with status ' + response.status,
        },
        { status: response.ok ? 500 : response.status },
      );
    }

    const queryFields: GraphField[] = Array.isArray(
      raw?.data?.__schema?.queryType?.fields,
    )
      ? raw.data.__schema.queryType.fields
      : [];

    const schemaTypes: GraphSchemaType[] = Array.isArray(
      raw?.data?.__schema?.types,
    )
      ? raw.data.__schema.types
      : [];

    const listProductField =
      queryFields.find((field) => field?.name === 'listProduct') ?? null;

    const listProductContract = normalizeFieldContract(listProductField);
    const paginationArg = listProductContract?.args.find(
      (arg) => arg.name === 'pagination',
    );

    const paginationInputType = paginationArg?.typeName
      ? schemaTypes.find((type) => type?.name === paginationArg.typeName) ?? null
      : null;

    const returnTypeName = listProductContract?.returnType.typeName ?? null;
    const returnSchemaType = returnTypeName
      ? schemaTypes.find((type) => type?.name === returnTypeName) ?? null
      : null;

    const returnFieldNames = Array.isArray(returnSchemaType?.fields)
      ? returnSchemaType.fields
          .map((field) => String(field?.name ?? '').trim())
          .filter(Boolean)
          .sort()
      : [];

    const evidence = {
      fieldFound: Boolean(listProductField),
      paginationArgumentFound: Boolean(paginationArg),
      paginationInputHasPage:
        normalizeInputType(paginationInputType)?.fields.some(
          (field) => field.name === 'page',
        ) ?? false,
      paginationInputHasLimit:
        normalizeInputType(paginationInputType)?.fields.some(
          (field) => field.name === 'limit',
        ) ?? false,
      returnHasData: returnFieldNames.includes('data'),
      returnHasCount: returnFieldNames.includes('count'),
      returnHasHasNext: returnFieldNames.includes('hasNext'),
      returnHasLimit: returnFieldNames.includes('limit'),
      returnHasPage: returnFieldNames.includes('page'),
      returnHasPaginationObject: returnFieldNames.includes('pagination'),
    };

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      auditVersion: 'g3_c2a_ikas_catalog_schema_v1',
      mutationPerformed: false,
      listProduct: listProductContract,
      paginationInput: normalizeInputType(paginationInputType),
      returnType: {
        name: returnTypeName,
        fields: returnFieldNames,
      },
      evidence,
      c2aReady:
        evidence.fieldFound &&
        evidence.paginationArgumentFound &&
        evidence.paginationInputHasPage &&
        evidence.paginationInputHasLimit &&
        evidence.returnHasData &&
        (evidence.returnHasHasNext || evidence.returnHasPaginationObject),
      error: undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        auditVersion: 'g3_c2a_ikas_catalog_schema_v1',
        mutationPerformed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
