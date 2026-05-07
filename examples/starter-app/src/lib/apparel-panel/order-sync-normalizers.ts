export function numberOr(value: unknown, fallback = 0) {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
}

export function dateOrNull(value: unknown) {
  if (value == null) return null;
  const num = Number(value);
  const date = Number.isFinite(num)
    ? new Date(num > 9999999999 ? num : num * 1000)
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cleanText(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
}

export function normalizeWaId(phone: string | null | undefined) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0')) return '9' + digits;
  if (digits.length === 10 && digits.startsWith('5')) return '90' + digits;
  return digits;
}

export function normalizeOrderStatus(value: string | null | undefined) {
  const s = cleanText(value).toUpperCase();
  if (['CREATED', 'APPROVED', 'OPEN'].includes(s)) return 'confirmed';
  if (['PROCESSING', 'PREPARING'].includes(s)) return 'processing';
  if (s === 'SHIPPED') return 'shipped';
  if (['DELIVERED', 'COMPLETED'].includes(s)) return 'delivered';
  if (['CANCELLED', 'CANCELED'].includes(s)) return 'canceled';
  return s ? s.toLocaleLowerCase('tr-TR') : 'pending';
}

export function normalizeFinancialStatus(value: string | null | undefined) {
  const s = cleanText(value).toUpperCase();
  if (['PAID', 'SUCCESS'].includes(s)) return 'paid';
  if (['PARTIALLY_PAID', 'PARTIAL_PAID'].includes(s)) return 'partially_paid';
  if (['REFUNDED'].includes(s)) return 'refunded';
  if (['VOIDED', 'CANCELLED', 'CANCELED'].includes(s)) return 'voided';
  return 'pending';
}

export function normalizeFulfillmentStatus(value: string | null | undefined) {
  const s = cleanText(value).toUpperCase();
  if (['PARTIALLY_FULFILLED', 'PARTIAL'].includes(s)) return 'partial';
  if (['FULFILLED', 'DELIVERED', 'COMPLETED'].includes(s)) return 'fulfilled';
  if (s === 'SHIPPED') return 'shipped';
  if (['CANCELLED', 'CANCELED'].includes(s)) return 'canceled';
  if (['RETURNED', 'REFUNDED'].includes(s)) return 'returned';
  return 'unfulfilled';
}

export function sizeFromSku(sku: string | null | undefined) {
  const last = cleanText(sku).toUpperCase().split('-').filter(Boolean).pop();
  return last && ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'].includes(last) ? last : null;
}

export function colorFromText(...values: Array<string | null | undefined>) {
  const text = cleanText(values.filter(Boolean).join(' '));
  const colors: Array<[string, string]> = [
    ['siyah', 'siyah'],
    ['beyaz', 'beyaz'],
    ['ekru', 'ekru'],
    ['vizon', 'vizon'],
    ['tas', 'taş'],
    ['taş', 'taş'],
    ['bej', 'bej'],
    ['mavi', 'mavi'],
    ['gri', 'gri'],
    ['kahverengi', 'kahverengi'],
    ['kahve', 'kahve'],
    ['yesil', 'yeşil'],
    ['yeşil', 'yeşil'],
  ];
  return colors.find(([needle]) => text.includes(cleanText(needle)))?.[1] || null;
}
