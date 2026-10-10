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
  if (!/^[A-Z]{3}$/.test(expectedCurrency)) {
    return { status: 'currency_not_configured', price: null };
  }

  const matchingPrices = prices.flatMap((price) => {
    const sourceCurrency =
      normalizeCurrencyCode(price?.currencyCode) || normalizeCurrencyCode(price?.currency);
    // GraphQL explicitly returns priceListId=null for the base price. Its nullable
    // currency fields may be omitted; only that row can use the source's configured
    // base currency. A named list or an explicitly different currency cannot.
    const isBasePrice = price?.priceListId === null;
    const usesSourceDefault = isBasePrice && !sourceCurrency;
    if ((sourceCurrency || (usesSourceDefault ? expectedCurrency : '')) !== expectedCurrency) {
      return [];
    }
    return [{
      row: price,
      isBasePrice,
      currencyBasis: usesSourceDefault ? 'source_default_base_price' : 'price_row',
    }];
  });

  if (matchingPrices.length === 0) {
    return { status: 'currency_not_found', price: null };
  }

  // The configured source uses the base catalog price, rather than a customer
  // price-list override in the same currency, when that base row is available.
  const basePrices = matchingPrices.filter((price) => price.isBasePrice);
  const selectedPrices = basePrices.length ? basePrices : matchingPrices;
  const values = selectedPrices.map((price) => price.row?.sellPrice);
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

  return {
    status: 'matched',
    price: numericValues[0],
    currencyBasis: selectedPrices.some((price) => price.currencyBasis === 'source_default_base_price')
      ? 'source_default_base_price'
      : 'price_row',
  };
}

export function describeIkasPriceResolutionFailures(items, products) {
  const sourceProducts = new Map(
    (Array.isArray(items) ? items : []).map((product) => [String(product?.id ?? ''), product]),
  );
  const samples = [];

  for (const product of Array.isArray(products) ? products : []) {
    const sourceProduct = sourceProducts.get(String(product?.id ?? ''));
    for (const variant of Array.isArray(product?.variants) ? product.variants : []) {
      if (!['currency_not_configured', 'currency_not_found', 'ambiguous_price'].includes(variant?.source_price_resolution)) {
        continue;
      }
      const sourceVariant = (Array.isArray(sourceProduct?.variants) ? sourceProduct.variants : [])
        .find((row) => String(row?.id ?? '') === String(variant?.id ?? ''));
      const prices = Array.isArray(sourceVariant?.prices) ? sourceVariant.prices : [];
      samples.push({
        external_product_id: String(product?.id ?? ''),
        external_variant_id: String(variant?.id ?? ''),
        resolution_status: variant.source_price_resolution,
        price_row_count: prices.length,
        price_rows: prices.slice(0, 5).map((price) => ({
          price_list_id: typeof price?.priceListId === 'string' ? price.priceListId : null,
          price_list_id_present: price != null && Object.hasOwn(price, 'priceListId'),
          currency: typeof price?.currency === 'string' ? price.currency : null,
          currency_code: typeof price?.currencyCode === 'string' ? price.currencyCode : null,
          has_finite_sell_price: typeof price?.sellPrice === 'number' && Number.isFinite(price.sellPrice),
        })),
      });
      if (samples.length === 10) return samples;
    }
  }
  return samples;
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

