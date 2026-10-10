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
  currencyBasis?: 'price_row' | 'source_default_base_price';
};

export type IkasPriceResolutionFailureSample = {
  external_product_id: string;
  external_variant_id: string;
  resolution_status: string;
  price_row_count: number;
  price_rows: Array<{
    price_list_id: string | null;
    price_list_id_present: boolean;
    currency: string | null;
    currency_code: string | null;
    has_finite_sell_price: boolean;
  }>;
};

export function describeIkasPriceResolutionFailures(
  items: unknown,
  products: unknown,
): IkasPriceResolutionFailureSample[];

export function summarizeIkasPriceResolutionFailures(
  products: unknown,
): Record<string, number>;

