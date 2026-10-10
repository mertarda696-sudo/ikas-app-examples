import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isIkasCatalogProductActive,
  resolveIkasSellPrice,
  summarizeIkasPriceResolutionFailures,
} from '../src/lib/catalog/catalog-payload-normalization-contract.mjs';

test('does not deactivate a product when one sales channel is passive and another is active', () => {
  assert.equal(
    isIkasCatalogProductActive(false, [
      { status: 'PASSIVE' },
      { status: 'ACTIVE' },
    ]),
    true,
  );
});

test('deactivates a product only when all reported channels are passive', () => {
  assert.equal(
    isIkasCatalogProductActive(false, [
      { status: 'PASSIVE' },
      { status: 'DISABLED' },
    ]),
    false,
  );
});

test('a deleted product is inactive regardless of channel status', () => {
  assert.equal(isIkasCatalogProductActive(true, [{ status: 'ACTIVE' }]), false);
});

test('missing channel status is not treated as proof of inactivity', () => {
  assert.equal(isIkasCatalogProductActive(false, []), true);
  assert.equal(isIkasCatalogProductActive(false, [{ name: 'Storefront' }]), true);
});

test('selects the sell price matching the configured currency, independent of array order', () => {
  assert.deepEqual(
    resolveIkasSellPrice(
      [
        { currencyCode: 'EUR', sellPrice: 12 },
        { currencyCode: 'TRY', sellPrice: 450 },
      ],
      'try',
    ),
    { status: 'matched', price: 450 },
  );
});

test('does not substitute a price from another currency', () => {
  assert.deepEqual(
    resolveIkasSellPrice([{ currencyCode: 'EUR', sellPrice: 12 }], 'TRY'),
    { status: 'currency_not_found', price: null },
  );
});

test('fails closed when matching price rows disagree', () => {
  assert.deepEqual(
    resolveIkasSellPrice(
      [
        { currencyCode: 'TRY', sellPrice: 450 },
        { currencyCode: 'TRY', sellPrice: 475 },
      ],
      'TRY',
    ),
    { status: 'ambiguous_price', price: null },
  );
});

test('reports missing and unusable prices without inventing a value', () => {
  assert.deepEqual(resolveIkasSellPrice([], 'TRY'), {
    status: 'missing_price',
    price: null,
  });
  assert.deepEqual(
    resolveIkasSellPrice([{ currencyCode: 'TRY' }], 'TRY'),
    { status: 'price_missing', price: null },
  );
  assert.deepEqual(
    resolveIkasSellPrice([{ currencyCode: 'TRY', sellPrice: 10 }], ''),
    { status: 'currency_not_configured', price: null },
  );
});

test('summarizes unresolved currency prices so the importer can fail closed', () => {
  assert.deepEqual(
    summarizeIkasPriceResolutionFailures([
      {
        variants: [
          { source_price_resolution: 'currency_not_found' },
          { source_price_resolution: 'ambiguous_price' },
          { source_price_resolution: 'matched' },
          { source_price_resolution: 'price_missing' },
        ],
      },
      { variants: [{ source_price_resolution: 'currency_not_found' }] },
    ]),
    { currency_not_found: 2, ambiguous_price: 1 },
  );
});
