import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Script, createContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/helpers/token-helpers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics.length, 0);

// Test fixtures are deliberately unsigned and never sent to a backend or provider.
const tokenFor = (overrides = {}) => [
  Buffer.from(JSON.stringify({ alg: 'QA_ONLY', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ aud: 'qa-app-a', sub: 'qa-merchant-a', exp: Math.floor(Date.now() / 1000) + 300, ...overrides })).toString('base64url'),
  'QA_ONLY_NOT_A_SIGNATURE',
].join('.');

function fixture({ embedded = true, request = async () => tokenFor(), storageBlocked = false } = {}) {
  const errors = [], storage = new Map(), calls = { token: 0, identity: 0 };
  const top = {}, window = { top, self: embedded ? {} : top };
  const exports = {};
  const context = createContext({
    exports, window, atob, TextDecoder, Uint8Array,
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { if (storageBlocked) throw new Error('Storage blocked'); storage.set(key, value); },
      removeItem: (key) => storage.delete(key),
    },
    console: { error: (...args) => errors.push(args.join(' ')) },
    require: (name) => {
      if (name === 'crypto') return require('node:crypto');
      if (name === '@ikas/app-helpers') return {
        AppBridgeHelper: {
          getAuthorizedAppId: () => { calls.identity++; throw new Error('Timed out getAuthorizedAppId'); },
          getNewToken: () => { calls.token++; return request(); },
        },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  new Script(compiled.outputText).runInContext(context);
  return { helper: exports.TokenHelpers, calls, storage, errors, context };
}

test('standalone access does not request a bridge token', async () => {
  const f = fixture({ embedded: false });
  assert.equal(await f.helper.getTokenForIframeApp(), null);
  assert.equal(f.calls.token, 0);
  assert.equal(f.calls.identity, 0);
});

test('server-side access does not access window or request a token', async () => {
  const f = fixture();
  delete f.context.window;
  assert.equal(await f.helper.getTokenForIframeApp(), null);
  assert.equal(f.calls.token, 0);
});

test('identity-response timeout cannot block requesting the current signed-token contract', async () => {
  const token = tokenFor();
  const f = fixture({ request: async () => token });
  assert.equal(await f.helper.getTokenForIframeApp(), token);
  assert.equal(f.calls.identity, 0);
  assert.equal(f.calls.token, 1);
  assert.equal(f.storage.get('token-qa-app-a'), token);
  assert.equal(f.storage.get('authorizedAppId'), 'qa-app-a');
});

test('concurrent page consumers share one bridge request', async () => {
  let resolve;
  const token = tokenFor();
  const f = fixture({ request: () => new Promise((done) => { resolve = done; }) });
  const first = f.helper.getTokenForIframeApp(), second = f.helper.getTokenForIframeApp();
  assert.equal(first, second);
  assert.equal(f.calls.token, 1);
  resolve(token);
  assert.deepEqual(await Promise.all([first, second]), [token, token]);
});

test('a stored token from another installation is never used as current identity', async () => {
  const fresh = tokenFor({ aud: 'qa-app-b', sub: 'qa-merchant-b' });
  const f = fixture({ request: async () => fresh });
  f.storage.set('authorizedAppId', 'qa-app-a');
  f.storage.set('token-qa-app-a', tokenFor());
  assert.equal(await f.helper.getTokenForIframeApp(), fresh);
  assert.equal(f.storage.get('authorizedAppId'), 'qa-app-b');
  assert.equal(f.storage.get('token-qa-app-b'), fresh);
});

test('sequential requests establish fresh scope rather than reuse prior merchant memory', async () => {
  const firstToken = tokenFor();
  const tokens = [firstToken, tokenFor({ aud: 'qa-app-b', sub: 'qa-merchant-b' })];
  const f = fixture({ request: async () => tokens.shift() });
  assert.equal(await f.helper.getTokenForIframeApp(), firstToken);
  const next = await f.helper.getTokenForIframeApp();
  assert.equal(f.calls.token, 2);
  assert.equal(f.storage.get('token-qa-app-b'), next);
});

test('missing provider token returns null without persisting identity', async () => {
  const f = fixture({ request: async () => undefined });
  assert.equal(await f.helper.getTokenForIframeApp(), null);
  assert.equal(f.storage.size, 0);
});

test('timeout clears the shared request so a subsequent attempt can succeed', async () => {
  let attempts = 0;
  const token = tokenFor();
  const f = fixture({ request: async () => { if (++attempts === 1) throw 'Timed out getNewToken'; return token; } });
  assert.equal(await f.helper.getTokenForIframeApp(), null);
  assert.equal(await f.helper.getTokenForIframeApp(), token);
  assert.equal(f.calls.token, 2);
});

test('malformed and expired tokens are not returned or persisted', async () => {
  for (const token of ['invalid', 'a.b.', tokenFor({ exp: Math.floor(Date.now() / 1000) - 1 })]) {
    const f = fixture({ request: async () => token });
    assert.equal(await f.helper.getTokenForIframeApp(), null);
    assert.equal(f.storage.size, 0);
  }
});

test('missing audience, subject or expiry and array audiences are rejected', async () => {
  for (const claims of [{ aud: '' }, { aud: ['qa-app-a'] }, { sub: '' }, { exp: null }, { exp: 'later' }]) {
    const f = fixture({ request: async () => tokenFor(claims) });
    assert.equal(await f.helper.getTokenForIframeApp(), null);
    assert.equal(f.storage.size, 0);
  }
});

test('blocked browser storage does not block a valid current bridge token', async () => {
  const token = tokenFor();
  const f = fixture({ request: async () => token, storageBlocked: true });
  assert.equal(await f.helper.getTokenForIframeApp(), token);
});

test('base64url UTF-8 payloads are decoded without altering the token', async () => {
  const token = tokenFor({ description: 'Türkçe mağaza' });
  const f = fixture({ request: async () => token });
  assert.equal(await f.helper.getTokenForIframeApp(), token);
});

test('provider rejection and malformed input are never printed as credentials', async () => {
  const sensitive = 'QA_SENSITIVE_VALUE_NOT_FOR_LOGS';
  const f = fixture({ request: async () => { throw new Error(sensitive); } });
  assert.equal(await f.helper.getTokenForIframeApp(), null);
  assert.equal(f.errors.length, 1);
  assert.ok(f.errors.every((message) => !message.includes(sensitive)));
});
