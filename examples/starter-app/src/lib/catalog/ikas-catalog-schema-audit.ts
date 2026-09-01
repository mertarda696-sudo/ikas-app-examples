import { config } from '@/globals/config';
import { isIkasTokenRefreshDue } from '@/helpers/api-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';

export const IKAS_CATALOG_SCHEMA_AUDIT_VERSION =
  'g3_c2a_ikas_catalog_schema_v3';

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

type PaginationProbePage = {
  count: number | null;
  hasNext: boolean | null;
  limit: number | null;
  page: number | null;
  itemCount: number;
  ids: string[];
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

function normalizeProbePage(value: any): PaginationProbePage {
  const data = Array.isArray(value?.data) ? value.data : [];

  return {
    count: Number.isInteger(value?.count) ? value.count : null,
    hasNext:
      typeof value?.hasNext === 'boolean' ? value.hasNext : null,
    limit: Number.isInteger(value?.limit) ? value.limit : null,
    page: Number.isInteger(value?.page) ? value.page : null,
    itemCount: data.length,
    ids: data
      .map((item: any) => String(item?.id ?? '').trim())
      .filter(Boolean),
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

const PAGINATION_PROBE_QUERY = `
  query G3CatalogPaginationBehaviorProbe(
    $pagination: PaginationInput,
    $sort: String
  ) {
    listProduct(
      pagination: $pagination,
      sort: $sort
    ) {
      count
      hasNext
      limit
      page
      data {
        id
      }
    }
  }
`;

async function fetchJsonGraphQl(input: {
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<{
  ok: boolean;
  status: number;
  raw: Record<string, any> | null;
  error: string | null;
}> {
  const response = await fetch(config.graphApiUrl!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + input.accessToken,
    },
    body: JSON.stringify({
      query: input.query,
      variables: input.variables ?? undefined,
    }),
    cache: 'no-store',
  });

  const responseText = await response.text();

  let raw: Record<string, any> | null = null;

  try {
    raw = responseText
      ? (JSON.parse(responseText) as Record<string, any>)
      : {};
  } catch {
    return {
      ok: false,
      status: response.status,
      raw: null,
      error: 'IKAS_GRAPHQL_NON_JSON_RESPONSE',
    };
  }

  if (!response.ok || Array.isArray(raw?.errors)) {
    return {
      ok: false,
      status: response.status,
      raw,
      error: String(
        raw?.errors?.[0]?.message ||
          'IKAS_GRAPHQL_REQUEST_FAILED',
      ),
    };
  }

  return {
    ok: true,
    status: response.status,
    raw,
    error: null,
  };
}

async function runPaginationBehaviorProbe(accessToken: string) {
  const pageSize = 2;
  const sort = 'id';

  const firstResponse = await fetchJsonGraphQl({
    accessToken,
    query: PAGINATION_PROBE_QUERY,
    variables: {
      pagination: {
        page: 1,
        limit: pageSize,
      },
      sort,
    },
  });

  if (!firstResponse.ok) {
    return {
      ready: false,
      sort,
      pageSize,
      error: firstResponse.error,
      upstreamStatus: firstResponse.status,
    };
  }

  const firstPage = normalizeProbePage(
    firstResponse.raw?.data?.listProduct,
  );

  let secondPage: PaginationProbePage | null = null;
  let secondResponseError: string | null = null;
  let secondResponseStatus: number | null = null;

  if (firstPage.hasNext === true) {
    const secondResponse = await fetchJsonGraphQl({
      accessToken,
      query: PAGINATION_PROBE_QUERY,
      variables: {
        pagination: {
          page: 2,
          limit: pageSize,
        },
        sort,
      },
    });

    secondResponseStatus = secondResponse.status;

    if (!secondResponse.ok) {
      secondResponseError = secondResponse.error;
    } else {
      secondPage = normalizeProbePage(
        secondResponse.raw?.data?.listProduct,
      );
    }
  }

  const firstIds = new Set(firstPage.ids);
  const duplicateIdsAcrossPages = secondPage
    ? secondPage.ids.filter((id) => firstIds.has(id))
    : [];

  const stableCountAcrossPages = secondPage
    ? firstPage.count === secondPage.count
    : true;

  const secondPageContractValid = firstPage.hasNext === true
    ? Boolean(
        secondPage &&
          secondPage.page === 2 &&
          secondPage.limit === pageSize &&
          secondResponseError == null,
      )
    : true;

  const evidence = {
    sortByIdAccepted: true,
    firstPageNumberMatchesRequest: firstPage.page === 1,
    firstPageLimitMatchesRequest: firstPage.limit === pageSize,
    firstPageHasBooleanHasNext:
      typeof firstPage.hasNext === 'boolean',
    firstPageHasIntegerCount:
      Number.isInteger(firstPage.count),
    firstPageRespectsLimit: firstPage.itemCount <= pageSize,
    secondPageContractValid,
    stableCountAcrossPages,
    noDuplicateIdsAcrossProbePages:
      duplicateIdsAcrossPages.length === 0,
  };

  return {
    ready: Object.values(evidence).every(Boolean),
    sort,
    pageSize,
    firstPage: {
      count: firstPage.count,
      hasNext: firstPage.hasNext,
      limit: firstPage.limit,
      page: firstPage.page,
      itemCount: firstPage.itemCount,
    },
    secondPage: secondPage
      ? {
          count: secondPage.count,
          hasNext: secondPage.hasNext,
          limit: secondPage.limit,
          page: secondPage.page,
          itemCount: secondPage.itemCount,
        }
      : null,
    secondResponseStatus,
    secondResponseError,
    evidence,
  };
}

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

    const introspectionResponse = await fetchJsonGraphQl({
      accessToken: authToken.accessToken,
      query: INTROSPECTION_QUERY,
    });

    if (!introspectionResponse.ok) {
      return fail(
        introspectionResponse.status || 502,
        introspectionResponse.error ||
          'IKAS_GRAPHQL_INTROSPECTION_FAILED',
        {
          upstreamStatus: introspectionResponse.status,
        },
      );
    }

    const raw = introspectionResponse.raw ?? {};

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

    const schemaReady =
      evidence.fieldFound &&
      evidence.paginationArgumentFound &&
      evidence.paginationInputHasPage &&
      evidence.paginationInputHasLimit &&
      evidence.returnHasData &&
      evidence.returnHasHasNext &&
      evidence.returnHasCount &&
      evidence.returnHasLimit &&
      evidence.returnHasPage;

    const paginationBehaviorProbe = schemaReady
      ? await runPaginationBehaviorProbe(authToken.accessToken)
      : {
          ready: false,
          error: 'SCHEMA_CONTRACT_NOT_READY_FOR_BEHAVIOR_PROBE',
        };

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
        schemaReady,
        paginationBehaviorProbe,
        c2aReady:
          schemaReady && paginationBehaviorProbe.ready === true,
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
