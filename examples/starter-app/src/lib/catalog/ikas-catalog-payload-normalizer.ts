export type NormalizedIkasCatalogProduct = Record<string, any> & {
  id: string;
  is_active: boolean;
};

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
}

function slugify(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSourceStatus(value: string | null | undefined) {
  return normalizeText(value).toUpperCase();
}

function isPassiveSalesChannelStatus(value: string | null | undefined) {
  return ['PASSIVE', 'INACTIVE', 'DISABLED', 'HIDDEN'].includes(
    normalizeSourceStatus(value),
  );
}

const APPAREL_COLOR_ALIASES: Array<[string, string]> = [
  ['siyah', 'siyah'],
  ['beyaz', 'beyaz'],
  ['ekru', 'ekru'],
  ['vizon', 'vizon'],
  ['tas', 'taş'],
  ['taş', 'taş'],
  ['bej', 'bej'],
  ['mavi', 'mavi'],
  ['lacivert', 'lacivert'],
  ['gri', 'gri'],
  ['haki', 'haki'],
  ['kahve', 'kahve'],
  ['kahverengi', 'kahverengi'],
  ['bordo', 'bordo'],
  ['krem', 'krem'],
];

function extractColorFromText(...values: Array<string | null | undefined>) {
  const merged = normalizeText(values.filter(Boolean).join(' '));

  for (const [needle, canonical] of APPAREL_COLOR_ALIASES) {
    if (merged.includes(normalizeText(needle))) {
      return canonical;
    }
  }

  return null;
}

const COLOR_OPTION_ALIASES = ['renk', 'color', 'colour'];
const APPAREL_SIZE_OPTION_ALIASES = ['beden', 'size', 'talla'];
const NUMBER_OPTION_ALIASES = [
  'numara',
  'number',
  'ayakkabi numarasi',
  'ayakkabı numarası',
  'ayakkabi numarası',
  'ayakkabı numarasi',
  'shoe number',
  'shoe size',
];
const EYEWEAR_FRAME_OPTION_ALIASES = [
  'ekartman',
  'ekartman ölçüsü',
  'ekartman olcusu',
  'frame size',
  'frame',
  'lens width',
  'cam genisligi',
  'cam genişliği',
];
const ONE_SIZE_OPTION_ALIASES = [
  'standart',
  'tek beden',
  'one size',
  'standard',
];
const FOOTWEAR_HINTS = [
  'ayakkabi',
  'ayakkabı',
  'topuklu',
  'sandalet',
  'terlik',
  'bot',
  'cizme',
  'çizme',
  'sneaker',
];
const EYEWEAR_HINTS = [
  'gozluk',
  'gözlük',
  'gunes gozlugu',
  'güneş gözlüğü',
  'cat eye',
  'eyewear',
  'sunglasses',
];
const NUMERIC_APPAREL_HINTS = [
  'pantolon',
  'etek',
  'elbise',
  'sort',
  'şort',
  'jean',
  'denim',
];

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
}

function hasAnyHint(surface: string, hints: string[]) {
  const normalizedSurface = normalizeText(surface);
  return hints.some((hint) => normalizedSurface.includes(normalizeText(hint)));
}

function isNumericLike(value: string | null | undefined) {
  return /^\d{1,3}$/.test(String(value || '').trim());
}

function getVariantOptionRows(variantValues: any[]) {
  return variantValues
    .map((value: any) => {
      const typeName = String(value?.variantTypeName || '').trim();
      const valueName = String(value?.variantValueName || '').trim();
      return {
        typeName,
        normalizedTypeName: normalizeText(typeName),
        valueName,
      };
    })
    .filter((value) => value.typeName || value.valueName);
}

function getVariantOptionMatch(variantValues: any[], aliases: string[]) {
  const aliasSet = new Set(aliases.map((alias) => normalizeText(alias)));
  return (
    getVariantOptionRows(variantValues).find((value) =>
      aliasSet.has(value.normalizedTypeName),
    ) || null
  );
}

function getVariantOptionValue(variantValues: any[], aliases: string[]) {
  return getVariantOptionMatch(variantValues, aliases)?.valueName ?? null;
}

function resolveVariantSizeOption(input: {
  variantValues: any[];
  productName: string | null | undefined;
  categoryName: string | null | undefined;
}) {
  const variantValues = Array.isArray(input.variantValues)
    ? input.variantValues
    : [];
  const optionRows = getVariantOptionRows(variantValues);
  const productSurface = [input.productName, input.categoryName]
    .filter(Boolean)
    .join(' ');

  const isFootwear = hasAnyHint(productSurface, FOOTWEAR_HINTS);
  const isEyewear = hasAnyHint(productSurface, EYEWEAR_HINTS);
  const isNumericApparel = hasAnyHint(productSurface, NUMERIC_APPAREL_HINTS);

  const apparelSizeMatch = getVariantOptionMatch(
    variantValues,
    APPAREL_SIZE_OPTION_ALIASES,
  );
  const numberMatch = getVariantOptionMatch(
    variantValues,
    NUMBER_OPTION_ALIASES,
  );
  const eyewearFrameMatch = getVariantOptionMatch(
    variantValues,
    EYEWEAR_FRAME_OPTION_ALIASES,
  );
  const oneSizeMatch = getVariantOptionMatch(
    variantValues,
    ONE_SIZE_OPTION_ALIASES,
  );

  const apparelSizeValue = apparelSizeMatch?.valueName || null;
  const numberValue = numberMatch?.valueName || null;
  const eyewearFrameValue = eyewearFrameMatch?.valueName || null;
  const oneSizeValue = oneSizeMatch?.valueName || null;
  const optionTypeNames = uniqueNonEmpty(optionRows.map((value) => value.typeName));

  if (isEyewear && eyewearFrameValue) {
    return {
      size_value: eyewearFrameValue,
      size_system: 'eyewear_frame',
      variant_dimension: 'frame_size',
      size_source_option_name: eyewearFrameMatch?.typeName || null,
      option_type_names: optionTypeNames,
      option_values: optionRows,
    };
  }

  if (
    isFootwear &&
    (numberValue || (apparelSizeValue && isNumericLike(apparelSizeValue)))
  ) {
    return {
      size_value: numberValue || apparelSizeValue,
      size_system: 'shoe_number',
      variant_dimension: 'shoe_number',
      size_source_option_name:
        numberMatch?.typeName || apparelSizeMatch?.typeName || null,
      option_type_names: optionTypeNames,
      option_values: optionRows,
    };
  }

  if (
    isNumericApparel &&
    ((apparelSizeValue && isNumericLike(apparelSizeValue)) ||
      (numberValue && isNumericLike(numberValue)))
  ) {
    return {
      size_value: apparelSizeValue || numberValue,
      size_system: 'numeric_apparel',
      variant_dimension: 'apparel_numeric_size',
      size_source_option_name:
        apparelSizeMatch?.typeName || numberMatch?.typeName || null,
      option_type_names: optionTypeNames,
      option_values: optionRows,
    };
  }

  if (apparelSizeValue) {
    return {
      size_value: apparelSizeValue,
      size_system: isNumericLike(apparelSizeValue) ? 'numeric_apparel' : 'alpha',
      variant_dimension: isNumericLike(apparelSizeValue)
        ? 'apparel_numeric_size'
        : 'apparel_alpha_size',
      size_source_option_name: apparelSizeMatch?.typeName || null,
      option_type_names: optionTypeNames,
      option_values: optionRows,
    };
  }

  if (numberValue) {
    return {
      size_value: numberValue,
      size_system: isNumericLike(numberValue) ? 'generic_number' : 'number',
      variant_dimension: 'number',
      size_source_option_name: numberMatch?.typeName || null,
      option_type_names: optionTypeNames,
      option_values: optionRows,
    };
  }

  if (eyewearFrameValue) {
    return {
      size_value: eyewearFrameValue,
      size_system: 'eyewear_frame',
      variant_dimension: 'frame_size',
      size_source_option_name: eyewearFrameMatch?.typeName || null,
      option_type_names: optionTypeNames,
      option_values: optionRows,
    };
  }

  if (oneSizeValue) {
    return {
      size_value: oneSizeValue,
      size_system: 'one_size',
      variant_dimension: 'standard',
      size_source_option_name: oneSizeMatch?.typeName || null,
      option_type_names: optionTypeNames,
      option_values: optionRows,
    };
  }

  return {
    size_value: null,
    size_system: 'unknown',
    variant_dimension: null,
    size_source_option_name: null,
    option_type_names: optionTypeNames,
    option_values: optionRows,
  };
}

export function normalizeIkasCatalogProducts(input: {
  items: any[];
  merchantId: string;
  storeName: string;
}): NormalizedIkasCatalogProduct[] {
  return input.items
    .map((item: any) => {
      const firstCategoryName =
        Array.isArray(item?.categories) && item.categories.length
          ? item.categories[0]?.name || null
          : null;
      const normalizedCategory = slugify(firstCategoryName) || 'unknown';
      const sourceBrandName = item?.brand?.name ?? null;
      const totalStock =
        typeof item?.totalStock === 'number' ? item.totalStock : null;
      const sourceSalesChannels = Array.isArray(item?.salesChannels)
        ? item.salesChannels
        : [];
      const sourceSalesChannelStatuses = sourceSalesChannels
        .map((channel: any) => channel?.status ?? null)
        .filter(Boolean);
      const sourceSalesChannelIsPassive = sourceSalesChannelStatuses.some(
        (status: string) => isPassiveSalesChannelStatus(status),
      );
      const productIsActive =
        item?.deleted !== true && !sourceSalesChannelIsPassive;

      const variantsRaw = Array.isArray(item?.variants) ? item.variants : [];
      const normalizedVariants = variantsRaw
        .map((variant: any) => {
          const variantValues = Array.isArray(variant?.variantValues)
            ? variant.variantValues
            : [];
          const optionSummary =
            variantValues
              .map((value: any) => {
                const typeName = value?.variantTypeName ?? '';
                const valueName = value?.variantValueName ?? '';
                return [typeName, valueName].filter(Boolean).join(': ');
              })
              .filter(Boolean)
              .join(' / ') || null;

          const sizeMeta = resolveVariantSizeOption({
            variantValues,
            productName: item?.name,
            categoryName: firstCategoryName,
          });
          const colorValue =
            getVariantOptionValue(variantValues, COLOR_OPTION_ALIASES) ||
            extractColorFromText(item?.name, optionSummary, variant?.sku);

          const prices = Array.isArray(variant?.prices) ? variant.prices : [];
          const firstPrice = prices[0] || null;
          const sellPrice =
            typeof firstPrice?.sellPrice === 'number'
              ? firstPrice.sellPrice
              : null;
          const stocks = Array.isArray(variant?.stocks) ? variant.stocks : [];
          const stockQty = stocks.reduce((sum: number, stock: any) => {
            const count =
              typeof stock?.stockCount === 'number' ? stock.stockCount : 0;
            return sum + count;
          }, 0);
          const stockStatus = !productIsActive
            ? 'out_of_stock'
            : stockQty > 0
              ? 'in_stock'
              : variant?.sellIfOutOfStock === true
                ? 'preorder'
                : 'out_of_stock';

          return {
            id: variant?.id ?? '',
            external_product_id: item?.id ?? '',
            sku: variant?.sku ?? null,
            title: optionSummary,
            color: colorValue,
            size: sizeMeta.size_value,
            price: sellPrice,
            stock_qty: productIsActive ? stockQty : 0,
            stock_status: stockStatus,
            is_active: productIsActive,
            sell_if_out_of_stock: variant?.sellIfOutOfStock ?? null,
            source_option_summary: optionSummary,
            source_option_values: sizeMeta.option_values,
            source_option_type_names: sizeMeta.option_type_names,
            source_size_system: sizeMeta.size_system,
            source_variant_dimension: sizeMeta.variant_dimension,
            source_size_option_name: sizeMeta.size_source_option_name,
            stock_preview: stocks.slice(0, 10).map((stock: any) => ({
              stock_location_id: stock?.stockLocationId ?? null,
              stock_count:
                typeof stock?.stockCount === 'number' ? stock.stockCount : null,
            })),
          };
        })
        .filter((variant: { id: string }) => !!variant.id);

      const sourceOptionTypeNames = uniqueNonEmpty(
        normalizedVariants.flatMap((variant: any) =>
          Array.isArray(variant.source_option_type_names)
            ? variant.source_option_type_names
            : [],
        ),
      );
      const sourceSizeSystems = uniqueNonEmpty(
        normalizedVariants.map((variant: any) => variant.source_size_system),
      );
      const sourceVariantDimensions = uniqueNonEmpty(
        normalizedVariants.map(
          (variant: any) => variant.source_variant_dimension,
        ),
      );

      return {
        id: item?.id ?? '',
        brand: sourceBrandName,
        title: item?.name ?? '-',
        handle: slugify(item?.name) || item?.id || '',
        category: normalizedCategory,
        currency: 'TRY',
        variants: normalizedVariants,
        is_active: productIsActive,
        attributes: {
          source_platform: 'ikas',
          sync_origin: 'ikas_app',
          merchant_id: input.merchantId,
          store_name: input.storeName,
          source_deleted: item?.deleted === true,
          source_sales_channels: sourceSalesChannels,
          source_sales_channel_statuses: sourceSalesChannelStatuses,
          source_sales_channel_is_passive: sourceSalesChannelIsPassive,
          source_category_name: firstCategoryName,
          source_brand_name: sourceBrandName,
          source_total_stock: totalStock,
          source_short_description_present: !!item?.shortDescription,
          source_description_present: !!item?.description,
          source_variant_count: normalizedVariants.length,
          source_option_type_names: sourceOptionTypeNames,
          source_size_systems: sourceSizeSystems,
          source_variant_dimensions: sourceVariantDimensions,
          source_has_shoe_number_option:
            sourceSizeSystems.includes('shoe_number'),
          source_has_eyewear_frame_option:
            sourceSizeSystems.includes('eyewear_frame'),
          source_has_numeric_apparel_option:
            sourceSizeSystems.includes('numeric_apparel'),
          source_variant_price_mode: 'sell_price_only',
          source_variant_stock_mode: 'stocks_sum',
        },
        base_price: null,
        description: item?.description ?? null,
        subcategory: null,
        stock_status: !productIsActive
          ? 'out_of_stock'
          : totalStock == null
            ? 'unknown'
            : totalStock > 0
              ? 'in_stock'
              : 'out_of_stock',
        short_description: item?.shortDescription ?? null,
        external_product_id: item?.id ?? '',
        created_at_source:
          item?.createdAt != null ? String(item.createdAt) : null,
      } satisfies NormalizedIkasCatalogProduct;
    })
    .filter((item: NormalizedIkasCatalogProduct) => !!item.id);
}
