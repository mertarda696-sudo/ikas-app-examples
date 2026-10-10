const PASSIVE_SALES_CHANNEL_STATUSES = new Set([
  'PASSIVE',
  'INACTIVE',
  'DISABLED',
  'HIDDEN',
]);

function normalizeCurrencyCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function isIkasCatalogProductActive(deleted, salesChannels) {
  if (deleted === true) return false;

  const statuses = (Array.isArray(salesChannels) ? salesChannels : [])
    .map((channel) => String(channel?.status ?? '').trim().toUpperCase())
    .filter(Boolean);

  // Keep the product available when at least one channel is not explicitly passive.
  // Missing channel data is not evidence that the source product is inactive.
  return !statuses.length || statuses.some((status) => !PASSIVE_SALES_CHANNEL_STATUSES.has(status));
}

export function resolveIkasSellPrice(prices, currencyDefault) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return { status: 'missing_price', price: null };
  }

  const expectedCurrency = normalizeCurrencyCode(currencyDefault);
  if (!expectedCurrency) {
    return { status: 'currency_not_configured', price: null };
  }

  const matchingPrices = prices.filter((price) => {
    const sourceCurrency = normalizeCurrencyCode(price?.currencyCode || price?.currency);
    return sourceCurrency === expectedCurrency;
  });

  if (matchingPrices.length === 0) {
    return { status: 'currency_not_found', price: null };
  }

  const values = matchingPrices.map((price) => price?.sellPrice);
  const numericValues = values.filter((value) => typeof value === 'number' && Number.isFinite(value));

  if (numericValues.length === 0) {
    return { status: 'price_missing', price: null };
  }

  if (numericValues.length !== values.length) {
    return { status: 'ambiguous_price', price: null };
  }

  const uniqueValues = new Set(numericValues);
  if (uniqueValues.size !== 1) {
    return { status: 'ambiguous_price', price: null };
  }

  return { status: 'matched', price: numericValues[0] };
}

export function summarizeIkasPriceResolutionFailures(products) {
  const failures = {};

  for (const product of Array.isArray(products) ? products : []) {
    for (const variant of Array.isArray(product?.variants) ? product.variants : []) {
      const status = variant?.source_price_resolution;
      if (!['currency_not_configured', 'currency_not_found', 'ambiguous_price'].includes(status)) {
        continue;
      }

      failures[status] = (failures[status] || 0) + 1;
    }
  }

  return failures;
}
