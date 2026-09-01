export type PaginatedCollectionPage<T> = {
  count: number;
  hasNext: boolean;
  limit: number;
  page: number;
  data: T[];
};

export type PaginatedTraversalErrorCode =
  | 'PAGINATION_INVALID_CONFIGURATION'
  | 'PAGINATION_INVALID_PAGE_RESPONSE'
  | 'PAGINATION_PAGE_MISMATCH'
  | 'PAGINATION_LIMIT_MISMATCH'
  | 'PAGINATION_COUNT_CHANGED'
  | 'PAGINATION_HAS_NEXT_INCONSISTENT'
  | 'PAGINATION_DUPLICATE_ITEM_KEY'
  | 'PAGINATION_ITEM_COUNT_MISMATCH';

export class PaginatedTraversalError extends Error {
  constructor(
    public readonly code: PaginatedTraversalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PaginatedTraversalError';
  }
}

export type PaginatedTraversalResult<T> = {
  items: T[];
  pageSize: number;
  pagesFetched: number;
  upstreamCount: number;
  firstPage: number;
  lastPage: number;
  traversalComplete: true;
};

export async function traversePaginatedCollection<T>(input: {
  pageSize: number;
  fetchPage: (
    requestedPage: number,
    pageSize: number,
  ) => Promise<PaginatedCollectionPage<T>>;
  getItemKey: (item: T) => string;
}): Promise<PaginatedTraversalResult<T>> {
  if (!Number.isInteger(input.pageSize) || input.pageSize <= 0) {
    throw new PaginatedTraversalError(
      'PAGINATION_INVALID_CONFIGURATION',
      'Pagination page size must be a positive integer.',
    );
  }

  const items: T[] = [];
  const seenKeys = new Set<string>();

  let requestedPage = 1;
  let upstreamCount: number | null = null;
  let expectedPages: number | null = null;

  while (true) {
    const page = await input.fetchPage(
      requestedPage,
      input.pageSize,
    );

    if (
      !Number.isInteger(page.count) ||
      page.count < 0 ||
      typeof page.hasNext !== 'boolean' ||
      !Number.isInteger(page.limit) ||
      page.limit <= 0 ||
      !Number.isInteger(page.page) ||
      page.page <= 0 ||
      !Array.isArray(page.data)
    ) {
      throw new PaginatedTraversalError(
        'PAGINATION_INVALID_PAGE_RESPONSE',
        `Invalid pagination response for requested page ${requestedPage}.`,
      );
    }

    if (page.page !== requestedPage) {
      throw new PaginatedTraversalError(
        'PAGINATION_PAGE_MISMATCH',
        `Requested page ${requestedPage} but upstream reported page ${page.page}.`,
      );
    }

    if (page.limit !== input.pageSize) {
      throw new PaginatedTraversalError(
        'PAGINATION_LIMIT_MISMATCH',
        `Requested page size ${input.pageSize} but upstream reported limit ${page.limit}.`,
      );
    }

    if (page.data.length > input.pageSize) {
      throw new PaginatedTraversalError(
        'PAGINATION_INVALID_PAGE_RESPONSE',
        `Upstream returned ${page.data.length} items for page size ${input.pageSize}.`,
      );
    }

    if (upstreamCount == null) {
      upstreamCount = page.count;
      expectedPages = Math.max(
        1,
        Math.ceil(upstreamCount / input.pageSize),
      );
    } else if (page.count !== upstreamCount) {
      throw new PaginatedTraversalError(
        'PAGINATION_COUNT_CHANGED',
        `Upstream item count changed from ${upstreamCount} to ${page.count} during traversal.`,
      );
    }

    for (const item of page.data) {
      const itemKey = String(input.getItemKey(item) ?? '').trim();

      if (!itemKey) {
        throw new PaginatedTraversalError(
          'PAGINATION_INVALID_PAGE_RESPONSE',
          `An item on page ${requestedPage} has no stable key.`,
        );
      }

      if (seenKeys.has(itemKey)) {
        throw new PaginatedTraversalError(
          'PAGINATION_DUPLICATE_ITEM_KEY',
          `Duplicate item key detected during traversal on page ${requestedPage}.`,
        );
      }

      seenKeys.add(itemKey);
      items.push(item);
    }

    const shouldHaveNext = requestedPage < (expectedPages ?? 1);

    if (page.hasNext !== shouldHaveNext) {
      throw new PaginatedTraversalError(
        'PAGINATION_HAS_NEXT_INCONSISTENT',
        `Upstream hasNext=${page.hasNext} is inconsistent with count=${upstreamCount}, page=${requestedPage}, pageSize=${input.pageSize}.`,
      );
    }

    if (!page.hasNext) {
      break;
    }

    requestedPage += 1;
  }

  const finalUpstreamCount = upstreamCount ?? 0;

  if (items.length !== finalUpstreamCount) {
    throw new PaginatedTraversalError(
      'PAGINATION_ITEM_COUNT_MISMATCH',
      `Traversal collected ${items.length} unique items but upstream count is ${finalUpstreamCount}.`,
    );
  }

  return {
    items,
    pageSize: input.pageSize,
    pagesFetched: requestedPage,
    upstreamCount: finalUpstreamCount,
    firstPage: 1,
    lastPage: requestedPage,
    traversalComplete: true,
  };
}
