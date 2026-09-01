import { config } from '@/globals/config';
import { isIkasTokenRefreshDue } from '@/helpers/api-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';

export const IKAS_CATALOG_SCHEMA_AUDIT_VERSION =
  'g3_c2a_ikas_catalog_schema_v2';

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

export type IkasCatalogSchemaAuditIdentity = {
  merchantId: string;
  authorizedAppId: string;
};

export type IkasCatalogSchemaAuditExecution = {
  status: number;
  body: Record<string, unknown>;
};

function normalizeIdentity(value: unknown): string {
  return String(value ?? '').trim();
}

function baseAuditBody() {
  return {
    fetchedAt: new Date().toISOString(),
    auditVersion: IKAS_CATALOG_SCHEMA_AUDIT_VERSION,
    mutationPerformed: false,
    credentialMutationPerformed: false,
  };
}

function fail(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
): IkasCatalogSchemaAuditExecution {
  return {
    status,
    body: {
      ok: false,
      ...baseAuditBody(),
      ...extra,
      error,
    },
  };
}

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

const INTROSPECTION_QUERY = `
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

export async function runIkasCatalogSchemaAudit(
  identity: IkasCatalogSchemaAuditIdentity,
): Promise<IkasCatalogSchemaAuditExecution> {
  try {
    const merchantId = normalizeIdentity(identity.merchantId);
    const authorizedAppId = normalizeIdentity(identity.authorizedAppId);

    if (!merchantId || !authorizedAppId) {
      return fail(400, 'IKAS_IDENTITY_CONTRACT_INCOMPLETE');
    }

    const authToken = await AuthTokenManager.getActiveByIdentity({
      merchantId,
      authorizedAppId,
    });

    if (!authToken?.accessToken) {
      return fail(404, 'IKAS_AUTH_TOKEN_NOT_FOUND');
    }

    if (!config.graphApiUrl) {
      return fail(500, 'IKAS_GRAPH_API_URL_NOT_CONFIGURED');
    }

    if (isIkasTokenRefreshDue(authToken)) {
      return fail(
        409,
        'IKAS_TOKEN_REFRESH_REQUIRED_FOR_READ_ONLY_AUDIT',
        {
          tokenRefreshRequired: true,
        },
      );
    }

    const response = await fetch(config.graphApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + authToken.accessToken,
      },
      body: JSON.stringify({ query: INTROSPECTION_QUERY }),
      cache: 'no-store',
    });

    const responseText = await response.text();

    let raw: Record<string, any>;

    try {
      raw = responseText
        ? (JSON.parse(responseText) as Record<string, any>)
        : {};
    } catch {
      return fail(502, 'IKAS_GRAPHQL_NON_JSON_RESPONSE', {
        upstreamStatus: response.status,
      });
    }

    if (!response.ok || Array.isArray(raw?.errors)) {
      return fail(
        response.ok ? 502 : response.status,
        String(
          raw?.errors?.[0]?.message ||
            'IKAS_GRAPHQL_INTROSPECTION_FAILED',
        ),
        {
          upstreamStatus: response.status,
        },
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

    const normalizedPaginationInput = normalizeInputType(
      paginationInputType,
    );

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
        normalizedPaginationInput?.fields.some(
          (field) => field.name === 'page',
        ) ?? false,
      paginationInputHasLimit:
        normalizedPaginationInput?.fields.some(
          (field) => field.name === 'limit',
        ) ?? false,
      returnHasData: returnFieldNames.includes('data'),
      returnHasCount: returnFieldNames.includes('count'),
      returnHasHasNext: returnFieldNames.includes('hasNext'),
      returnHasLimit: returnFieldNames.includes('limit'),
      returnHasPage: returnFieldNames.includes('page'),
      returnHasPaginationObject: returnFieldNames.includes('pagination'),
    };

    const c2aReady =
      evidence.fieldFound &&
      evidence.paginationArgumentFound &&
      evidence.paginationInputHasPage &&
      evidence.paginationInputHasLimit &&
      evidence.returnHasData &&
      (evidence.returnHasHasNext || evidence.returnHasPaginationObject);

    return {
      status: 200,
      body: {
        ok: true,
        ...baseAuditBody(),
        listProduct: listProductContract,
        paginationInput: normalizedPaginationInput,
        returnType: {
          name: returnTypeName,
          fields: returnFieldNames,
        },
        evidence,
        c2aReady,
      },
    };
  } catch (error) {
    return fail(
      500,
      error instanceof Error
        ? error.message
        : 'UNKNOWN_IKAS_CATALOG_SCHEMA_AUDIT_ERROR',
    );
  }
}
