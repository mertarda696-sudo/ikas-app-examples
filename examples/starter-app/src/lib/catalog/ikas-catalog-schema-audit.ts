import { config } from '@/globals/config';
import { isIkasTokenRefreshDue } from '@/helpers/api-helpers';
import {
  fetchIkasProductTraversal,
  IkasProductTraversalError,
} from '@/lib/catalog/ikas-product-traversal';
import { PaginatedTraversalError } from '@/lib/catalog/paginated-traversal';
import { AuthTokenManager } from '@/models/auth-token/manager';

export const IKAS_CATALOG_SCHEMA_AUDIT_VERSION =
  'g3_c3_ikas_variant_collection_schema_v1';

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

  return {
    name: field.name ?? null,
    returnType: unwrapNamedType(field.type),
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

const TYPE_REF_SELECTION = `
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
`;

const FIELD_SELECTION = `
  name
  args {
    name
    defaultValue
    type {
      ${TYPE_REF_SELECTION}
    }
  }
  type {
    ${TYPE_REF_SELECTION}
  }
`;

const INTROSPECTION_QUERY = `
  query G3CatalogPaginationSchemaAudit {
    __schema {
      queryType {
        fields(includeDeprecated: true) {
          ${FIELD_SELECTION}
        }
      }
      types {
        kind
        name
        inputFields {
          name
          defaultValue
          type {
            ${TYPE_REF_SELECTION}
          }
        }
        fields(includeDeprecated: true) {
          ${FIELD_SELECTION}
        }
      }
    }
  }
`;

async function fetchIntrospection(accessToken: string): Promise<{
  ok: boolean;
  status: number;
  raw: Record<string, any> | null;
  error: string | null;
}> {
  const response = await fetch(config.graphApiUrl!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    body: JSON.stringify({ query: INTROSPECTION_QUERY }),
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
          'IKAS_GRAPHQL_INTROSPECTION_FAILED',
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

    const introspectionResponse = await fetchIntrospection(
      authToken.accessToken,
    );

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

    const returnDataField = Array.isArray(returnSchemaType?.fields)
      ? returnSchemaType.fields.find((field) => field?.name === 'data') ?? null
      : null;

    const returnDataContract = normalizeFieldContract(returnDataField);
    const productTypeName = returnDataContract?.returnType.typeName ?? null;
    const productSchemaType = productTypeName
      ? schemaTypes.find((type) => type?.name === productTypeName) ?? null
      : null;

    const variantsField = Array.isArray(productSchemaType?.fields)
      ? productSchemaType.fields.find((field) => field?.name === 'variants') ?? null
      : null;

    const variantsContract = normalizeFieldContract(variantsField);
    const variantPaginationArg = variantsContract?.args.find(
      (arg) => arg.name === 'pagination',
    );

    const variantsReturnTypeName =
      variantsContract?.returnType.typeName ?? null;
    const variantsReturnSchemaType = variantsReturnTypeName
      ? schemaTypes.find((type) => type?.name === variantsReturnTypeName) ?? null
      : null;

    const variantsReturnFieldNames = Array.isArray(
      variantsReturnSchemaType?.fields,
    )
      ? variantsReturnSchemaType.fields
          .map((field) => String(field?.name ?? '').trim())
          .filter(Boolean)
          .sort()
      : [];

    const variantCollectionEvidence = {
      returnDataFieldFound: Boolean(returnDataField),
      productTypeResolved: Boolean(productTypeName),
      variantsFieldFound: Boolean(variantsField),
      variantsIsDirectList:
        variantsContract?.returnType.isList === true,
      variantsHasNoArguments:
        (variantsContract?.args.length ?? -1) === 0,
      variantsHasPaginationArgument: Boolean(variantPaginationArg),
      variantsReturnLooksPaginated:
        variantsReturnFieldNames.includes('data') &&
        variantsReturnFieldNames.includes('hasNext'),
    };

    const variantCollectionSchemaComplete =
      variantCollectionEvidence.returnDataFieldFound &&
      variantCollectionEvidence.productTypeResolved &&
      variantCollectionEvidence.variantsFieldFound &&
      variantCollectionEvidence.variantsIsDirectList &&
      variantCollectionEvidence.variantsHasNoArguments &&
      !variantCollectionEvidence.variantsHasPaginationArgument &&
      !variantCollectionEvidence.variantsReturnLooksPaginated;

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
    };

    const schemaReady = Object.values(evidence).every(Boolean);

    let traversalProbe: Record<string, unknown>;

    if (!schemaReady) {
      traversalProbe = {
        ready: false,
        error: 'SCHEMA_CONTRACT_NOT_READY_FOR_TRAVERSAL_PROBE',
      };
    } else {
      try {
        const traversal = await fetchIkasProductTraversal({
          graphApiUrl: config.graphApiUrl,
          accessToken: authToken.accessToken,
          mode: 'id_only',
          pageSize: 2,
        });

        traversalProbe = {
          ready:
            traversal.traversalComplete === true &&
            traversal.items.length === traversal.upstreamCount,
          contractVersion: traversal.contractVersion,
          sort: traversal.sort,
          pageSize: traversal.pageSize,
          pagesFetched: traversal.pagesFetched,
          upstreamCount: traversal.upstreamCount,
          collectedItemCount: traversal.items.length,
          firstPage: traversal.firstPage,
          lastPage: traversal.lastPage,
          traversalComplete: traversal.traversalComplete,
        };
      } catch (error) {
        traversalProbe = {
          ready: false,
          error:
            error instanceof IkasProductTraversalError ||
            error instanceof PaginatedTraversalError
              ? error.code
              : error instanceof Error
                ? error.message
                : 'UNKNOWN_TRAVERSAL_PROBE_ERROR',
        };
      }
    }

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
        productCollection: {
          returnData: returnDataContract,
          productTypeName,
        },
        variantCollection: {
          variants: variantsContract,
          variantsReturnTypeName,
          variantsReturnFields: variantsReturnFieldNames,
          evidence: variantCollectionEvidence,
          schemaComplete: variantCollectionSchemaComplete,
        },
        evidence,
        schemaReady,
        traversalProbe,
        c2aReady:
          schemaReady && traversalProbe.ready === true,
        c3VariantCollectionSchemaReady:
          variantCollectionSchemaComplete,
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
