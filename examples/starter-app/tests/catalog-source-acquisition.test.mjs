import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');

function loadSource(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

const scope = { tenantId: '11111111-1111-4111-8111-111111111111',
  catalogSourceId: '22222222-2222-4222-8222-222222222222',
  catalogSourceAccountBindingId: '33333333-3333-4333-8333-333333333333' };
const acquiredAt = new Date('2026-10-13T00:00:00.000Z');

function harness(gate = {}, lock = true) {
  const events = [];
  const contracts = [];
  const tx = {
    async $queryRaw(strings) {
      const sql = strings.join('?');
      if (sql.includes('pg_try_advisory_xact_lock')) {
        events.push('lock'); return [{ acquired: lock }];
      }
      if (sql.includes('active_binding')) {
        events.push('gate'); return [{ active_binding: true, active_run: false,
          open_raw: false, acquired_at: acquiredAt, transaction_id: 'QA-TX', ...gate }];
      }
      assert.match(sql, /INSERT INTO public.catalog_sync_runs/);
      events.push('run'); return [{ id: '44444444-4444-4444-8444-444444444444' }];
    },
    async $executeRaw() { events.push('raw'); return 1; },
  };
  const prisma = {
    async $transaction(work, options) {
      assert.ok(options === undefined || options.timeout <= 60_000);
      try { const result = await work(tx); events.push('commit'); return result; }
      catch (error) { events.push('rollback'); throw error; }
    },
  };
  const writer = loadSource('../src/lib/catalog/catalog-fetch-outcome-writer.ts', {
    '@prisma/client': { Prisma: { sql: (strings, ...values) => ({ strings, values }), join: (rows) => rows } },
    '@/lib/prisma': { prisma },
    '@/lib/catalog/catalog-fetch-run-contract-writer': {
      async writeCatalogFetchRunContract(actualTx, input) {
        assert.equal(actualTx, tx); contracts.push(input); events.push('contract');
        return { authorityBasis: input.authority.basis, authorityOrder: '4',
          contractVersion: 'e2_fetch_v1', authorityContractVersion: 'e2_source_authority_v1',
          adapterMode: 'QA_ADAPTER', fetchSemantics: 'full_snapshot', completionState: input.completionState,
          traversalComplete: true, productCollectionComplete: true, variantCollectionComplete: true,
          productReconciliationState: 'pending', variantReconciliationState: 'pending' };
      },
    },
  });
  return { writer, events, contracts };
}

function outcome(startedAt, changes = {}) {
  return { ...scope, syncMode: 'full', startedAt, finishedAt: '2026-10-13T00:00:01.000Z',
    notes: 'Declared isolated QA fixture', metadata: { environment: 'qa' },
    contract: { adapterMode: 'QA_ADAPTER', fetchSemantics: 'full_snapshot', completionState: 'complete',
      traversalComplete: true, productCollectionComplete: true, variantCollectionComplete: true,
      authority: { basis: 'fetch_completed_at' }, adapterEvidence: { evidence_contract_version: 'QA' } },
    rawItems: [], ...changes };
}

test('provider read and persistence share the source lock; evidence comes from the acquired transaction', async () => {
  const h = harness();
  await h.writer.withCatalogSourceAcquisition(scope, async (session) => {
    h.events.push('provider'); assert.ok(session.signal instanceof AbortSignal);
    return session.persistOutcome(outcome(session.startedAt));
  });
  assert.deepEqual(h.events, ['lock', 'gate', 'provider', 'run', 'contract', 'commit']);
  const evidence = h.contracts[0].adapterEvidence;
  assert.equal(evidence.ordering_guarantee, 'serialized_source_acquisition');
  assert.equal(evidence.source_acquisition.transaction_id, 'QA-TX');
  assert.equal(evidence.source_acquisition.acquired_at, acquiredAt.toISOString());
  assert.equal(evidence.source_acquisition.catalog_source_id, scope.catalogSourceId);
});

for (const [label, gate, lock, code] of [
  ['competing acquisition', {}, false, 'FETCH_OUTCOME_SOURCE_BUSY'],
  ['active importer', { active_run: true }, true, 'FETCH_OUTCOME_SOURCE_BUSY'],
  ['unprocessed prior RAW', { open_raw: true }, true, 'FETCH_OUTCOME_SOURCE_BUSY'],
  ['wrong or retired binding', { active_binding: false }, true, 'FETCH_OUTCOME_ACQUISITION_SCOPE_MISMATCH'],
]) test(`${label} cannot begin a provider read`, async () => {
  const h = harness(gate, lock); let read = false;
  await assert.rejects(h.writer.withCatalogSourceAcquisition(scope, async () => { read = true; }), { code });
  assert.equal(read, false); assert.equal(h.contracts.length, 0); assert.equal(h.events.at(-1), 'rollback');
});

test('local completion authority cannot be persisted through the unsynchronized entry point', async () => {
  const h = harness();
  await assert.rejects(h.writer.persistCatalogFetchOutcome(outcome(acquiredAt)), { code: 'FETCH_OUTCOME_ACQUISITION_REQUIRED' });
  assert.deepEqual(h.events, []);
});

test('cross-source outcome and pre-acquisition timestamps are rejected', async () => {
  for (const changes of [{ catalogSourceId: '55555555-5555-4555-8555-555555555555' }, { startedAt: '2026-10-12T00:00:00Z' }]) {
    const h = harness();
    await assert.rejects(h.writer.withCatalogSourceAcquisition(scope, (session) => session.persistOutcome(outcome(session.startedAt, changes))),
      { code: 'FETCH_OUTCOME_ACQUISITION_SCOPE_MISMATCH' });
    assert.equal(h.contracts.length, 0);
  }
});

test('a callback without an outcome cannot commit', async () => {
  const h = harness();
  await assert.rejects(h.writer.withCatalogSourceAcquisition(scope, async () => 'empty'), { code: 'FETCH_OUTCOME_ACQUISITION_INCOMPLETE' });
  assert.equal(h.events.at(-1), 'rollback');
});

test('one acquisition cannot write two terminal outcomes or reuse a closed session', async () => {
  const h = harness(); let retained;
  await h.writer.withCatalogSourceAcquisition(scope, async (session) => {
    retained = session;
    await session.persistOutcome(outcome(session.startedAt));
    await assert.rejects(session.persistOutcome(outcome(session.startedAt)), { code: 'FETCH_OUTCOME_ACQUISITION_SCOPE_MISMATCH' });
  });
  await assert.rejects(retained.persistOutcome(outcome(retained.startedAt)), { code: 'FETCH_OUTCOME_ACQUISITION_SCOPE_MISMATCH' });
  assert.equal(h.contracts.length, 1);
});

function service(h, { traversalFails = false, priceFails = false } = {}) {
  class TraversalError extends Error { code = 'QA_TRAVERSAL_FAILED'; status = 502; }
  class OtherError extends Error {}
  const source = { ...scope, bindingId: scope.catalogSourceAccountBindingId, sourceName: 'Declared QA Source', sourceConfig: { currency_default: 'TRY' } };
  return loadSource('../src/lib/catalog/ikas-catalog-fetch-service.ts', {
    '@/globals/config': { config: { graphApiUrl: 'https://qa.invalid/graphql' } },
    './catalog-payload-normalization-contract.mjs': { summarizeIkasPriceResolutionFailures: () => priceFails ? { unresolved: 1 } : {}, describeIkasPriceResolutionFailures: () => [] },
    '@/helpers/api-helpers': { isIkasTokenRefreshDue: () => false, onCheckToken: async () => ({ accessToken: 'QA_ONLY' }) },
    '@/lib/catalog/catalog-fetch-outcome-writer': h.writer,
    '@/lib/catalog/catalog-fetch-run-contract-writer': { CatalogFetchRunContractError: OtherError },
    '@/lib/catalog/ikas-catalog-payload-normalizer': { normalizeIkasCatalogProducts: () => [] },
    '@/lib/catalog/commerce-source-resolver': { CommerceSourceResolutionError: OtherError, resolveCatalogSourceByCommerceIdentity: async () => source },
    '@/lib/catalog/ikas-product-traversal': { IkasProductTraversalError: TraversalError,
      fetchIkasProductTraversal: async (input) => { h.events.push('provider'); assert.ok(input.signal instanceof AbortSignal); if (traversalFails) throw new TraversalError('QA'); return { items: [], upstreamCount: 0, contractVersion: 'QA', sort: 'id', pageSize: 50, pagesFetched: 1, traversalComplete: true }; } },
    '@/lib/catalog/paginated-traversal': { PaginatedTraversalError: OtherError },
    '@/lib/catalog/catalog-import-trigger-contract.mjs': { classifyCatalogImportTrigger: () => null },
    '@/models/auth-token/manager': { AuthTokenManager: { getActiveByIdentity: async () => ({ accessToken: 'QA_ONLY' }) } },
  });
}

test('the real service dispatches only after fetch commit', async () => {
  const h = harness(); const s = service(h);
  const oldUrl = process.env.N8N_CATALOG_IMPORT_WEBHOOK_URL;
  const oldFetch = globalThis.fetch;
  process.env.N8N_CATALOG_IMPORT_WEBHOOK_URL = 'https://qa.invalid/webhook';
  globalThis.fetch = async (_, init) => {
    assert.equal(h.events.at(-1), 'commit'); h.events.push('trigger');
    assert.equal(JSON.parse(init.body).catalogSourceId, scope.catalogSourceId);
    return { ok: true, status: 200 };
  };
  try {
    const result = await s.executeIkasCatalogFetch({ merchantId: 'QA', authorizedAppId: 'QA' });
    assert.equal(result.status, 200); assert.equal(result.body.importStatus, 'triggered');
    assert.deepEqual(h.events, ['lock', 'gate', 'provider', 'run', 'contract', 'commit', 'trigger']);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.N8N_CATALOG_IMPORT_WEBHOOK_URL;
    else process.env.N8N_CATALOG_IMPORT_WEBHOOK_URL = oldUrl;
  }
});

for (const [label, options] of [['traversal failure', { traversalFails: true }], ['currency failure', { priceFails: true }]]) {
  test(`${label} persists a real failure without dispatching`, async () => {
    const h = harness(); const result = await service(h, options).executeIkasCatalogFetch({ merchantId: 'QA', authorizedAppId: 'QA' });
    assert.equal(result.body.fetchStatus, 'failed'); assert.equal(result.body.importStatus, 'skipped');
    assert.equal(h.contracts[0].completionState, 'failed'); assert.equal(h.events.includes('raw'), false);
    assert.equal(h.events.includes('trigger'), false); assert.equal(h.events.at(-1), 'commit');
  });
}
