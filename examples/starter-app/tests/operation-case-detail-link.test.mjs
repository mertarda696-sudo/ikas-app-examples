import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL('../src/components/apparel-panel/OperationCaseDetailLink.tsx', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
});
const exports = {};
runInNewContext(outputText, { exports, require });

const renderLink = (props) =>
  renderToStaticMarkup(createElement(exports.OperationCaseDetailLink, props));

test('uses the record ID for both normal and test case numbers', () => {
  const caseId = '06291c75-20ed-4c27-8703-f232c4370824';
  for (const caseNo of ['OP-451', 'STK-QA-44651', null]) {
    assert.ok(renderLink({ caseId, caseNo }).includes(`href="/operations/${caseId}"`));
  }
});

test('encodes a legacy case number as one path segment when the record ID is absent', () => {
  assert.ok(renderLink({ caseId: null, caseNo: 'RET/2026 #17' })
    .includes('href="/operations/RET%2F2026%20%2317"'));
});

test('renders no link when the case identity is missing', () => {
  assert.equal(renderLink({ caseId: ' ', caseNo: null }), '');
});
