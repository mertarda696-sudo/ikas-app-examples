import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyCatalogImportTrigger } from '../src/lib/catalog/catalog-import-trigger-contract.mjs';

test('treats a successful webhook response as a confirmed trigger', () => {
  assert.equal(
    classifyCatalogImportTrigger({
      configured: true,
      ok: true,
      status: 202,
    }),
    null,
  );
});

test('reports a missing webhook configuration', () => {
  assert.equal(
    classifyCatalogImportTrigger({
      configured: false,
      ok: false,
      status: null,
    }),
    'webhook_not_configured',
  );
});

test('reports an HTTP error response', () => {
  assert.equal(
    classifyCatalogImportTrigger({
      configured: true,
      ok: false,
      status: 503,
    }),
    'webhook_http_error',
  );
});

test('reports a network failure without an HTTP status', () => {
  assert.equal(
    classifyCatalogImportTrigger({
      configured: true,
      ok: false,
      status: null,
    }),
    'webhook_network_error',
  );
});

test('reports a trigger skipped after a failed traversal', () => {
  assert.equal(
    classifyCatalogImportTrigger({
      configured: true,
      ok: false,
      status: null,
      skipped: true,
    }),
    'trigger_skipped',
  );
});
