export type IkasSellPriceResolutionStatus =
  | 'missing_price'
  | 'currency_not_configured'
  | 'currency_not_found'
  | 'price_missing'
  | 'ambiguous_price'
  | 'matched';

export function isIkasCatalogProductActive(
  deleted: unknown,
  salesChannels: unknown,
): boolean;

export function resolveIkasSellPrice(
  prices: unknown,
  currencyDefault: string,
): {
  status: IkasSellPriceResolutionStatus;
  price: number | null;
};

export function summarizeIkasPriceResolutionFailures(
  products: unknown,
): Record<string, number>;
