import {
  PaginatedTraversalError,
  traversePaginatedCollection,
} from '@/lib/catalog/paginated-traversal';

export const IKAS_PRODUCT_TRAVERSAL_CONTRACT_VERSION =
  'g3_c2_ikas_product_traversal_v1';

export const IKAS_PRODUCT_PAGE_SIZE = 50;
export const IKAS_PRODUCT_SORT = 'id';

export type IkasProductTraversalMode = 'full' | 'id_only';

export type IkasProductTraversalErrorCode =
  | 'IKAS_PRODUCT_TRAVERSAL_INVALID_CONFIGURATION'
  | 'IKAS_GRAPHQL_NON_JSON_RESPONSE'
  | 'IKAS_GRAPHQL_REQUEST_FAILED'
  | 'IKAS_LOGIN_REQUIRED_TOKEN_EXPIRED'
  | 'IKAS_LIST_PRODUCT_RESPONSE_INVALID';

export class IkasProductTraversalError extends Error {
  constructor(
    public readonly code: IkasProductTraversalErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'IkasProductTraversalError';
  }
}

const ID_ONLY_QUERY = `
  query G3IkasProductIdTraversal(
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

const FULL_PRODUCT_QUERY = `
  query G3IkasProductTraversal(
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
        name
        createdAt
        shortDescription
        description
        totalStock
        deleted
        salesChannels {
          id
          status
        }
        brand {
          name
        }
        categories {
          name
        }
        variants {
          id
          sku
          sellIfOutOfStock
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
            id
            productId
            variantId
            stockLocationId
            stockCount
          }
        }
      }
    }
  }
`;

function getQuery(mode: IkasProductTraversalMode): string {
  return mode === 'id_only'
    ? ID_ONLY_QUERY
    : FULL_PRODUCT_QUERY;
}

function normalizeGraphQlError(raw: Record<string, any> | null) {
  const firstError = Array.isArray(raw?.errors)
    ? raw?.errors?.[0]
    : null;

  const message = String(firstError?.message ?? '').trim();
  const extensionCode = String(
    firstError?.extensions?.code ?? '',
  ).trim();

  const combined = `${message} ${extensionCode}`.toUpperCase();

  if (combined.includes('LOGIN_REQUIRED')) {
    return {
      code: 'IKAS_LOGIN_REQUIRED_TOKEN_EXPIRED' as const,
      message:
        'ikas access token is invalid or expired and login is required.',
    };
  }

  return {
    code: 'IKAS_GRAPHQL_REQUEST_FAILED' as const,
    message:
      message ||
      extensionCode ||
      'ikas GraphQL request failed.',
  };
}

export async function fetchIkasProductTraversal(input: {
  graphApiUrl: string;
  accessToken: string;
  mode?: IkasProductTraversalMode;
  pageSize?: number;
}) {
  const graphApiUrl = String(input.graphApiUrl ?? '').trim();
  const accessToken = String(input.accessToken ?? '').trim();
  const mode = input.mode ?? 'full';
  const pageSize = input.pageSize ?? IKAS_PRODUCT_PAGE_SIZE;

  if (
    !graphApiUrl ||
    !accessToken ||
    !Number.isInteger(pageSize) ||
    pageSize <= 0 ||
    pageSize > IKAS_PRODUCT_PAGE_SIZE
  ) {
    throw new IkasProductTraversalError(
      'IKAS_PRODUCT_TRAVERSAL_INVALID_CONFIGURATION',
      500,
      'IKAS product traversal configuration is invalid.',
    );
  }

  const query = getQuery(mode);

  try {
    const traversal = await traversePaginatedCollection<any>({
      pageSize,
      getItemKey: (item) => String(item?.id ?? '').trim(),
      fetchPage: async (requestedPage, requestedPageSize) => {
        const response = await fetch(graphApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + accessToken,
          },
          body: JSON.stringify({
            query,
            variables: {
              pagination: {
                page: requestedPage,
                limit: requestedPageSize,
              },
              sort: IKAS_PRODUCT_SORT,
            },
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
          throw new IkasProductTraversalError(
            'IKAS_GRAPHQL_NON_JSON_RESPONSE',
            502,
            'ikas GraphQL returned a non-JSON response.',
          );
        }

        if (!response.ok || Array.isArray(raw?.errors)) {
          const normalizedError = normalizeGraphQlError(raw);

          throw new IkasProductTraversalError(
            normalizedError.code,
            normalizedError.code ===
            'IKAS_LOGIN_REQUIRED_TOKEN_EXPIRED'
              ? 401
              : response.ok
                ? 502
                : response.status,
            normalizedError.message,
          );
        }

        const listProduct = raw?.data?.listProduct;

        if (!listProduct || !Array.isArray(listProduct?.data)) {
          throw new IkasProductTraversalError(
            'IKAS_LIST_PRODUCT_RESPONSE_INVALID',
            502,
            'ikas listProduct response is missing pagination data.',
          );
        }

        return {
          count: listProduct.count,
          hasNext: listProduct.hasNext,
          limit: listProduct.limit,
          page: listProduct.page,
          data: listProduct.data,
        };
      },
    });

    return {
      ...traversal,
      contractVersion: IKAS_PRODUCT_TRAVERSAL_CONTRACT_VERSION,
      sort: IKAS_PRODUCT_SORT,
      mode,
    };
  } catch (error) {
    if (
      error instanceof IkasProductTraversalError ||
      error instanceof PaginatedTraversalError
    ) {
      throw error;
    }

    throw new IkasProductTraversalError(
      'IKAS_GRAPHQL_REQUEST_FAILED',
      502,
      error instanceof Error
        ? error.message
        : 'Unknown IKAS product traversal error.',
    );
  }
}
