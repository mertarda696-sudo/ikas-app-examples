import { onCheckToken } from '@/helpers/api-helpers';
import { config } from '@/globals/config';
import { getTenantPanelContextByMerchantId } from '@/lib/apparel-panel/queries';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

type IdRow = { id: string };
type VariantRow = { product_id: string | null; variant_id: string | null };

const ORDER_LIMIT = 25;

function n(value: unknown, fallback = 0) {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
}

function d(value: unknown) {
  if (value == null) return null;
  const num = Number(value);
  const date = Number.isFinite(num)
    ? new Date(num > 9999999999 ? num : num * 1000)
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function clean(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
}

function wa(phone: string | null | undefined) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0')) return '9' + digits;
  if (digits.length === 10 && digits.startsWith('5')) return '90' + digits;
  return digits;
}

function status(value: string | null | undefined) {
  const s = clean(value).toUpperCase();
  if (['CREATED', 'APPROVED', 'OPEN'].includes(s)) return 'confirmed';
  if (['PROCESSING', 'PREPARING'].includes(s)) return 'processing';
  if (s === 'SHIPPED') return 'shipped';
  if (['DELIVERED', 'COMPLETED'].includes(s)) return 'delivered';
  if (['CANCELLED', 'CANCELED'].includes(s)) return 'canceled';
  return s ? s.toLocaleLowerCase('tr-TR') : 'pending';
}

function financial(value: string | null | undefined) {
  const s = clean(value).toUpperCase();
  if (['PAID', 'SUCCESS'].includes(s)) return 'paid';
  if (['PARTIALLY_PAID', 'PARTIAL_PAID'].includes(s)) return 'partially_paid';
  if (['REFUNDED'].includes(s)) return 'refunded';
  if (['VOIDED', 'CANCELLED', 'CANCELED'].includes(s)) return 'voided';
  return 'pending';
}

function fulfillment(value: string | null | undefined) {
  const s = clean(value).toUpperCase();
  if (['PARTIALLY_FULFILLED', 'PARTIAL'].includes(s)) return 'partial';
  if (['FULFILLED', 'DELIVERED', 'COMPLETED'].includes(s)) return 'fulfilled';
  if (s === 'SHIPPED') return 'shipped';
  if (['CANCELLED', 'CANCELED'].includes(s)) return 'canceled';
  if (['RETURNED', 'REFUNDED'].includes(s)) return 'returned';
  return 'unfulfilled';
}

function sizeFromSku(sku: string | null | undefined) {
  const last = clean(sku).toUpperCase().split('-').filter(Boolean).pop();
  return last && ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'].includes(last) ? last : null;
}

function colorFromText(...values: Array<string | null | undefined>) {
  const text = clean(values.filter(Boolean).join(' '));
  const colors: Array<[string, string]> = [
    ['siyah', 'siyah'], ['beyaz', 'beyaz'], ['ekru', 'ekru'], ['vizon', 'vizon'],
    ['tas', 'taş'], ['taş', 'taş'], ['bej', 'bej'], ['mavi', 'mavi'], ['gri', 'gri'],
    ['kahverengi', 'kahverengi'], ['kahve', 'kahve'], ['yesil', 'yeşil'], ['yeşil', 'yeşil'],
  ];
  return colors.find(([needle]) => text.includes(clean(needle)))?.[1] || null;
}

async function token(authorizedAppId: string) {
  const saved = await AuthTokenManager.get(authorizedAppId);
  if (!saved?.accessToken) throw new Error('IKAS_AUTH_TOKEN_NOT_FOUND');
  const refreshed = await onCheckToken(saved);
  return refreshed.accessToken || saved.accessToken;
}

async function gql<T>(accessToken: string, query: string): Promise<T> {
  if (!config.graphApiUrl) throw new Error('Graph API URL not configured');
  const res = await fetch(config.graphApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  });
  const body = await res.json();
  if (!res.ok || body?.errors) throw new Error(body?.errors?.[0]?.message || 'GraphQL request failed');
  return body as T;
}

async function variantMap(
  tenantId: string,
  externalVariantId: string | null | undefined,
  sku: string | null | undefined,
): Promise<VariantRow> {
  const cleanExternalVariantId = String(externalVariantId || '').trim();
  const cleanSku = String(sku || '').trim();

  if (cleanExternalVariantId) {
    const rows = await prisma.$queryRaw<VariantRow[]>`
      select product_id, id as variant_id
      from public.product_variants
      where tenant_id = CAST(${tenantId} AS uuid)
        and external_variant_id = ${cleanExternalVariantId}
      limit 1
    `;

    if (rows[0]) return rows[0];
  }

  if (cleanSku) {
    const rowsBySku = await prisma.$queryRaw<VariantRow[]>`
      select product_id, id as variant_id
      from public.product_variants
      where tenant_id = CAST(${tenantId} AS uuid)
        and sku = ${cleanSku}
      limit 1
    `;

    if (rowsBySku[0]) return rowsBySku[0];
  }

  return { product_id: null, variant_id: null };
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user?.merchantId || !user?.authorizedAppId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized', syncedOrders: [] }, { status: 401 });
    }

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);
    if (!tenant) {
      return NextResponse.json({ ok: false, error: 'Tenant not found for merchant', syncedOrders: [] }, { status: 404 });
    }

    const accessToken = await token(user.authorizedAppId);
    const query = `query IkasOrderSync { listOrder(pagination: { page: 1, limit: ${ORDER_LIMIT} }, sort: "orderedAt:desc") { count data { id orderNumber status orderPaymentStatus orderPackageStatus orderedAt createdAt updatedAt currencyCode totalPrice totalFinalPrice note customer { fullName email phone } paymentMethods { type paymentGatewayName } shippingLines { title price finalPrice } orderLineItems { id quantity price unitPrice finalPrice discountPrice currencyCode status variant { id name sku } } orderPackages { trackingInfo { trackingNumber trackingLink cargoCompany } } } } }`;
    const result = await gql<any>(accessToken, query);
    const orders = Array.isArray(result?.data?.listOrder?.data) ? result.data.listOrder.data : [];
    const syncedOrders: Array<{ orderNo: string; orderId: string; action: string; itemCount: number }> = [];

    for (const order of orders) {
      const externalOrderId = String(order?.id || '').trim();
      if (!externalOrderId) continue;

      const orderNo = String(order?.orderNumber || externalOrderId).trim();
      const phone = order?.customer?.phone || null;
      const shippingLine = Array.isArray(order?.shippingLines) ? order.shippingLines[0] : null;
      const packageItem = Array.isArray(order?.orderPackages) ? order.orderPackages[0] : null;
      const tracking = packageItem?.trackingInfo || null;
      const payment = Array.isArray(order?.paymentMethods) ? order.paymentMethods[0] : null;
      const orderedAt = d(order?.orderedAt) || d(order?.createdAt) || new Date();
      const createdAt = d(order?.createdAt) || orderedAt;
      const updatedAt = d(order?.updatedAt) || new Date();

      const existing = await prisma.$queryRaw<IdRow[]>`
        select id from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and external_order_id = ${externalOrderId}
        limit 1
      `;

      let orderId = existing[0]?.id || null;
      let action = orderId ? 'updated' : 'created';

      if (orderId) {
        await prisma.$executeRaw`
          update public.commerce_orders set
            order_no = ${orderNo}, source_platform = 'ikas', customer_name = ${order?.customer?.fullName || null},
            customer_email = ${order?.customer?.email || null}, customer_phone = ${phone}, customer_wa_id = ${wa(phone)},
            status = ${status(order?.status)}, financial_status = ${financial(order?.orderPaymentStatus)},
            fulfillment_status = ${fulfillment(order?.orderPackageStatus)}, currency = ${order?.currencyCode || 'TRY'},
            subtotal_amount = ${n(order?.totalPrice)}, discount_amount = 0, shipping_amount = ${n(shippingLine?.finalPrice ?? shippingLine?.price)},
            tax_amount = 0, total_amount = ${n(order?.totalFinalPrice ?? order?.totalPrice)},
            payment_method = ${payment?.paymentGatewayName || payment?.type || null}, shipping_method = ${shippingLine?.title || null},
            cargo_company = ${tracking?.cargoCompany || null}, tracking_number = ${tracking?.trackingNumber || null}, tracking_url = ${tracking?.trackingLink || null},
            note = ${order?.note || null}, ordered_at = ${orderedAt}, updated_at = ${updatedAt}
          where id = CAST(${orderId} AS uuid)
        `;
      } else {
        const inserted = await prisma.$queryRaw<IdRow[]>`
          insert into public.commerce_orders (
            tenant_id, order_no, source_platform, external_order_id, customer_name, customer_email, customer_phone, customer_wa_id,
            status, financial_status, fulfillment_status, currency, subtotal_amount, discount_amount, shipping_amount, tax_amount,
            total_amount, payment_method, shipping_method, cargo_company, tracking_number, tracking_url, note, ordered_at, created_at, updated_at
          ) values (
            CAST(${tenant.tenantId} AS uuid), ${orderNo}, 'ikas', ${externalOrderId}, ${order?.customer?.fullName || null},
            ${order?.customer?.email || null}, ${phone}, ${wa(phone)}, ${status(order?.status)}, ${financial(order?.orderPaymentStatus)},
            ${fulfillment(order?.orderPackageStatus)}, ${order?.currencyCode || 'TRY'}, ${n(order?.totalPrice)}, 0,
            ${n(shippingLine?.finalPrice ?? shippingLine?.price)}, 0, ${n(order?.totalFinalPrice ?? order?.totalPrice)},
            ${payment?.paymentGatewayName || payment?.type || null}, ${shippingLine?.title || null}, ${tracking?.cargoCompany || null},
            ${tracking?.trackingNumber || null}, ${tracking?.trackingLink || null}, ${order?.note || null}, ${orderedAt}, ${createdAt}, ${updatedAt}
          ) returning id
        `;
        orderId = inserted[0]?.id || null;
      }

      if (!orderId) throw new Error('ORDER_UPSERT_FAILED');

      await prisma.$executeRaw`
        delete from public.commerce_order_items
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and order_id = CAST(${orderId} AS uuid)
      `;

      const items = Array.isArray(order?.orderLineItems) ? order.orderLineItems : [];
      for (const item of items) {
        const variant = item?.variant || null;
        const map = await variantMap(tenant.tenantId, variant?.id || null, variant?.sku || null);
        const sku = variant?.sku || null;
        const productName = variant?.name || 'Ürün';
        const quantity = n(item?.quantity, 1);
        const unitPrice = n(item?.finalUnitPrice ?? item?.unitPrice ?? item?.price);
        await prisma.$executeRaw`
          insert into public.commerce_order_items (
            tenant_id, order_id, product_id, variant_id, sku, product_name, variant_title, color, size, quantity,
            currency, unit_price, discount_amount, total_amount, fulfillment_status, return_status
          ) values (
            CAST(${tenant.tenantId} AS uuid), CAST(${orderId} AS uuid), CAST(${map.product_id} AS uuid), CAST(${map.variant_id} AS uuid),
            ${sku}, ${productName}, null, ${colorFromText(productName, sku)}, ${sizeFromSku(sku)}, ${quantity},
            ${item?.currencyCode || order?.currencyCode || 'TRY'}, ${unitPrice}, ${n(item?.discountPrice)},
            ${n(item?.finalPrice ?? item?.price, unitPrice * quantity)}, ${fulfillment(item?.status)}, null
          )
        `;
      }

      syncedOrders.push({ orderNo, orderId, action, itemCount: items.length });
    }

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      tenant,
      sourceCount: n(result?.data?.listOrder?.count),
      fetchedCount: orders.length,
      syncedCount: syncedOrders.length,
      syncedOrders,
      error: null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, fetchedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'Unknown error', syncedOrders: [] }, { status: 500 });
  }
}
