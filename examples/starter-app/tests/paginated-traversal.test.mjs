import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const sourcePath = new URL('../src/lib/catalog/paginated-traversal.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const traversalModule = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
const { PaginatedTraversalError, traversePaginatedCollection } = traversalModule;

test('collects a stable multi-page snapshot and confirms its final count', async () => {
  const requests = [];
  const result = await traversePaginatedCollection({
    pageSize: 2,
    getItemKey: (item) => item.id,
    fetchPage: async (page, limit) => {
      requests.push([page, limit]);
      return page === 1
        ? { count: 3, hasNext: true, limit, page, data: [{ id: 'a' }, { id: 'b' }] }
        : { count: 3, hasNext: false, limit, page, data: [{ id: 'c' }] };
    },
  });

  assert.deepEqual(requests, [[1, 2], [2, 2]]);
  assert.deepEqual(result.items.map((item) => item.id), ['a', 'b', 'c']);
  assert.equal(result.traversalComplete, true);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.upstreamCount, 3);
});

test('accepts an empty but explicitly complete collection', async () => {
  const result = await traversePaginatedCollection({
    pageSize: 50,
    getItemKey: (item) => item.id,
    fetchPage: async (page, limit) => ({
      count: 0,
      hasNext: false,
      limit,
      page,
      data: [],
    }),
  });

  assert.equal(result.traversalComplete, true);
  assert.equal(result.items.length, 0);
  assert.equal(result.pagesFetched, 1);
});

test('rejects a page identity mismatch', async () => {
  await assert.rejects(
    traversePaginatedCollection({
      pageSize: 2,
      getItemKey: (item) => item.id,
      fetchPage: async (_page, limit) => ({
        count: 1,
        hasNext: false,
        limit,
        page: 2,
        data: [{ id: 'a' }],
      }),
    }),
    (error) => error instanceof PaginatedTraversalError && error.code === 'PAGINATION_PAGE_MISMATCH',
  );
});

test('rejects a changing upstream count', async () => {
  await assert.rejects(
    traversePaginatedCollection({
      pageSize: 1,
      getItemKey: (item) => item.id,
      fetchPage: async (page, limit) => ({
        count: page === 1 ? 2 : 3,
        hasNext: page === 1,
        limit,
        page,
        data: [{ id: String(page) }],
      }),
    }),
    (error) => error.code === 'PAGINATION_COUNT_CHANGED',
  );
});

test('rejects hasNext that conflicts with the declared item count', async () => {
  await assert.rejects(
    traversePaginatedCollection({
      pageSize: 2,
      getItemKey: (item) => item.id,
      fetchPage: async (page, limit) => ({
        count: 1,
        hasNext: true,
        limit,
        page,
        data: [{ id: 'a' }],
      }),
    }),
    (error) => error.code === 'PAGINATION_HAS_NEXT_INCONSISTENT',
  );
});

test('rejects duplicate stable keys across pages', async () => {
  await assert.rejects(
    traversePaginatedCollection({
      pageSize: 1,
      getItemKey: (item) => item.id,
      fetchPage: async (page, limit) => ({
        count: 2,
        hasNext: page === 1,
        limit,
        page,
        data: [{ id: 'duplicate' }],
      }),
    }),
    (error) => error.code === 'PAGINATION_DUPLICATE_ITEM_KEY',
  );
});

test('rejects an item without a stable key', async () => {
  await assert.rejects(
    traversePaginatedCollection({
      pageSize: 2,
      getItemKey: (item) => item.id,
      fetchPage: async (page, limit) => ({
        count: 1,
        hasNext: false,
        limit,
        page,
        data: [{}],
      }),
    }),
    (error) => error.code === 'PAGINATION_INVALID_PAGE_RESPONSE',
  );
});
