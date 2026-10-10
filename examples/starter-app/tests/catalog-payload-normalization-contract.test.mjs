import assert from 'node:assert/strict';
import test from 'node:test';

import {
  describeIkasPriceResolutionFailures,
  isIkasCatalogProductActive,
  resolveIkasSellPrice,
  summarizeIkasPriceResolutionFailures,
} from '../src/lib/catalog/catalog-payload-normalization-contract.mjs';
import { normalizeIkasCatalogProducts } from '../src/lib/catalog/ikas-catalog-payload-normalizer.ts';

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
    { status: 'matched', price: 450, currencyBasis: 'price_row' },
  );
});

test('uses configured source currency only for an explicitly identified base price with nullable currency fields', () => {
  assert.deepEqual(
    resolveIkasSellPrice([{ priceListId: null, currency: null, currencyCode: null, sellPrice: 450 }], 'TRY'),
    { status: 'matched', price: 450, currencyBasis: 'source_default_base_price' },
  );
});

test('the base-price rule works for the configured currency without hardcoding TRY', () => {
  assert.deepEqual(
    resolveIkasSellPrice([{ priceListId: null, currency: null, sellPrice: 15 }], 'eur'),
    { status: 'matched', price: 15, currencyBasis: 'source_default_base_price' },
  );
});

test('a named price list with no currency cannot inherit the source base currency', () => {
  assert.deepEqual(
    resolveIkasSellPrice([{ priceListId: 'customer-list', currency: null, sellPrice: 450 }], 'TRY'),
    { status: 'currency_not_found', price: null },
  );
});

test('missing price-list identity is not proof of a base price', () => {
  assert.deepEqual(
    resolveIkasSellPrice([{ currency: null, sellPrice: 450 }], 'TRY'),
    { status: 'currency_not_found', price: null },
  );
});

test('an explicitly foreign base price cannot be relabeled as the configured currency', () => {
  assert.deepEqual(
    resolveIkasSellPrice([{ priceListId: null, currencyCode: 'EUR', sellPrice: 15 }], 'TRY'),
    { status: 'currency_not_found', price: null },
  );
});

test('a matching base price takes precedence over a customer-list override in the same currency', () => {
  const base = { priceListId: null, currencyCode: null, currency: null, sellPrice: 450 };
  const override = { priceListId: 'customer-list', currencyCode: 'TRY', sellPrice: 400 };
  for (const rows of [[override, base], [base, override]]) {
    assert.deepEqual(resolveIkasSellPrice(rows, 'TRY'), {
      status: 'matched', price: 450, currencyBasis: 'source_default_base_price',
    });
  }
});

test('duplicate base prices that disagree still fail closed', () => {
  assert.deepEqual(resolveIkasSellPrice([
    { priceListId: null, currency: null, sellPrice: 450 },
    { priceListId: null, currency: null, sellPrice: 475 },
  ], 'TRY'), { status: 'ambiguous_price', price: null });
});

test('a blank currencyCode does not hide a valid currency field', () => {
  assert.deepEqual(
    resolveIkasSellPrice([{ currencyCode: ' ', currency: 'try', sellPrice: 450 }], 'TRY'),
    { status: 'matched', price: 450, currencyBasis: 'price_row' },
  );
});

test('the production normalizer retains a nullable-currency base price and records its authority', () => {
  const result = normalizeIkasCatalogProducts({
    items: [{ id: 'product-fixture', name: 'Fixture', variants: [{
      id: 'variant-fixture', prices: [{ priceListId: null, currencyCode: null, currency: null, sellPrice: 450 }],
      stocks: [{ stockCount: 4 }],
    }] }],
    merchantId: 'merchant-fixture', storeName: 'Fixture', currencyDefault: 'TRY',
  });
  assert.equal(result[0].currency, 'TRY');
  assert.equal(result[0].variants[0].price, 450);
  assert.equal(result[0].variants[0].source_price_currency_basis, 'source_default_base_price');
  assert.equal(result[0].variants[0].stock_qty, 4);
  assert.deepEqual(summarizeIkasPriceResolutionFailures(result), {});
});

test('the production normalizer rejects an unresolved named list and exposes only price identity diagnostics', () => {
  const items = [{ id: 'product-fixture', variants: [{
    id: 'variant-fixture', prices: [{ priceListId: 'list-fixture', currencyCode: null, currency: null, sellPrice: 450, unrelated: 'discard' }],
  }] }];
  const result = normalizeIkasCatalogProducts({
    items, merchantId: 'merchant-fixture', storeName: 'Fixture', currencyDefault: 'TRY',
  });
  assert.equal(result[0].variants[0].price, null);
  assert.deepEqual(summarizeIkasPriceResolutionFailures(result), { currency_not_found: 1 });
  assert.deepEqual(describeIkasPriceResolutionFailures(items, result), [{
    external_product_id: 'product-fixture', external_variant_id: 'variant-fixture',
    resolution_status: 'currency_not_found', price_row_count: 1,
    price_rows: [{ price_list_id: 'list-fixture', price_list_id_present: true, currency: null, currency_code: null, has_finite_sell_price: true }],
  }]);
});

test('failure diagnostics are bounded to ten variants and five price rows per sample', () => {
  const items = [{ id: 'product-fixture', variants: Array.from({ length: 12 }, (_, index) => ({
    id: 'variant-' + index, prices: Array.from({ length: 8 }, () => ({ priceListId: 'list-fixture', sellPrice: 450 })),
  })) }];
  const result = normalizeIkasCatalogProducts({
    items, merchantId: 'merchant-fixture', storeName: 'Fixture', currencyDefault: 'TRY',
  });
  const samples = describeIkasPriceResolutionFailures(items, result);
  assert.equal(samples.length, 10);
  assert.equal(samples[0].price_row_count, 8);
  assert.equal(samples[0].price_rows.length, 5);
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

