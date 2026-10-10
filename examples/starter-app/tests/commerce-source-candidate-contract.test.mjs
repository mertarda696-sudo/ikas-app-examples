import assert from 'node:assert/strict';
import test from 'node:test';

import { selectExactCommerceSourceCandidate } from '../src/lib/catalog/commerce-source-candidate-contract.mjs';

function row(overrides = {}) {
  return {
    tenant_id: 'tenant-a',
    external_commerce_account_id: 'account-a',
    binding_id: 'binding-a',
    catalog_source_id: 'source-a',
    identifier_type: 'merchant_id',
    identifier_value: 'merchant-a',
    ...overrides,
  };
}

const identities = [
  { identifierType: 'merchant_id', identifierValue: 'merchant-a' },
  { identifierType: 'authorized_app_id', identifierValue: 'app-a' },
];

test('resolves only when every supplied identity belongs to the same tenant binding and source', () => {
  const result = selectExactCommerceSourceCandidate(
    [
      row(),
      row({
        identifier_type: 'authorized_app_id',
        identifier_value: 'app-a',
      }),
    ],
    identities,
  );

  assert.equal(result.status, 'matched');
  if (result.status === 'matched') {
    assert.equal(result.row.tenant_id, 'tenant-a');
    assert.equal(result.row.catalog_source_id, 'source-a');
    assert.deepEqual(result.matchedIdentifierTypes, ['authorized_app_id', 'merchant_id']);
  }
});

test('rejects split identities across different tenants instead of falling back to either match', () => {
  const result = selectExactCommerceSourceCandidate(
    [
      row(),
      row({
        tenant_id: 'tenant-b',
        external_commerce_account_id: 'account-b',
        binding_id: 'binding-b',
        catalog_source_id: 'source-b',
        identifier_type: 'authorized_app_id',
        identifier_value: 'app-a',
      }),
    ],
    identities,
  );

  assert.deepEqual(result, { status: 'not_found' });
});

test('rejects an identity contract that matches multiple active source bindings as ambiguous', () => {
  const result = selectExactCommerceSourceCandidate(
    [
      row(),
      row({
        identifier_type: 'authorized_app_id',
        identifier_value: 'app-a',
      }),
      row({
        external_commerce_account_id: 'account-other',
        binding_id: 'binding-other',
        catalog_source_id: 'source-other',
      }),
      row({
        external_commerce_account_id: 'account-other',
        binding_id: 'binding-other',
        catalog_source_id: 'source-other',
        identifier_type: 'authorized_app_id',
        identifier_value: 'app-a',
      }),
    ],
    identities,
  );

  assert.deepEqual(result, { status: 'ambiguous' });
});
