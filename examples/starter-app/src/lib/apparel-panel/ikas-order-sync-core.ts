import { onCheckToken } from '@/helpers/api-helpers';
import { config } from '@/globals/config';
import { prisma } from '@/lib/prisma';
import { getTenantPanelContextByMerchantId } from '@/lib/apparel-panel/queries';
import { AuthTokenManager } from '@/models/auth-token/manager';
import {
  colorFromText,
  dateOrNull,
  normalizeFinancialStatus,
  normalizeFulfillmentStatus,
  normalizeOrderStatus,
  normalizeWaId,
  numberOr,
  sizeFromSku,
} from '@/lib/apparel-panel/order-sync-normalizers';

type IdRow = { id: string };
type VariantRow = { product_id: string | null; variant_id: string | null };

type SyncIdentity = {
  merchantId: string;
  authorizedAppId: string;
};

export type IkasOrderSyncResult = {
  tenant: unknown;
  sourceCount: number;
  fetchedCount: number;
  syncedCount: number;
  syncedOrders: Array<{ orderNo: string; orderId: string; action: string; itemCount: number }>;
};

const ORDER_LIMIT = 25;

async function getIkasToken(authorizedAppId: string) {
  const saved = await AuthTokenManager.get(authorizedAppId);
  if (!saved?.accessToken) throw new Error('IKAS_AUTH_TOKEN_NOT_FOUND');
  const refreshed = await onCheckToken(saved);
  return refreshed.accessToken || saved.accessToken;
}

async function ikasGraphQL<T>(accessToken: string, query: string): Promise<T> {
  if (!config.graphApiUrl) throw new Error('Graph API URL not configured');

  const response = await fetch(config.graphApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + accessToken,
    },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  });

  const body = await response.json();

  if (!response.ok || body?.errors) {
    throw new Error(body?.errors?.[0]?.message || 'GraphQL request failed');
  }

  return body as T;
}

async function findVariantMap(
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

function orderQuery() {
  return `query IkasOrderSync {
    listOrder(pagination: { page: 1, limit: ${ORDER_LIMIT} }, sort: "orderedAt:desc") {
      count
      data {
        id
        orderNumber
        status
        orderPaymentStatus
        orderPackageStatus
        orderedAt
        createdAt
        updatedAt
        currencyCode
        totalPrice
        totalFinalPrice
        note
        customer { fullName email phone }
        paymentMethods { type paymentGatewayName }
        shippingLines { title price finalPrice }
        orderLineItems {
          id quantity price unitPrice finalPrice discountPrice currencyCode status
          variant { id name sku }
        }
        orderPackages { trackingInfo { trackingNumber trackingLink cargoCompany } }
      }
    }
  }`;
}

export async function syncIkasOrdersForIdentity(identity: SyncIdentity): Promise<IkasOrderSyncResult> {
  const tenant = await getTenantPanelContextByMerchantId(identity.merchantId);
  if (!tenant) throw new Error('Tenant not found for merchant ' + identity.merchantId);

  const accessToken = await getIkasToken(identity.authorizedAppId);
  const response = await ikasGraphQL<any>(accessToken, orderQuery());
  const orders = Array.isArray(response?.data?.listOrder?.data) ? response.data.listOrder.data : [];
  const syncedOrders: IkasOrderSyncResult['syncedOrders'] = [];

  for (const order of orders) {
    const externalOrderId = String(order?.id || '').trim();
    if (!externalOrderId) continue;

    const orderNo = String(order?.orderNumber || externalOrderId).trim();
    const phone = order?.customer?.phone || null;
    const shippingLine = Array.isArray(order?.shippingLines) ? order.shippingLines[0] : null;
    const packageItem = Array.isArray(order?.orderPackages) ? order.orderPackages[0] : null;
    const tracking = packageItem?.trackingInfo || null;
    const payment = Array.isArray(order?.paymentMethods) ? order.paymentMethods[0] : null;
    const orderedAt = dateOrNull(order?.orderedAt) || dateOrNull(order?.createdAt) || new Date();
    const createdAt = dateOrNull(order?.createdAt) || orderedAt;
    const updatedAt = dateOrNull(order?.updatedAt) || new Date();

    const existing = await prisma.$queryRaw<IdRow[]>`
      select id
      from public.commerce_orders
      where tenant_id = CAST(${tenant.tenantId} AS uuid)
        and external_order_id = ${externalOrderId}
      limit 1
    `;

    let orderId = existing[0]?.id || null;
    const action = orderId ? 'updated' : 'created';

    if (orderId) {
      await prisma.$executeRaw`
        update public.commerce_orders set
          order_no = ${orderNo},
          source_platform = 'ikas',
          customer_name = ${order?.customer?.fullName || null},
          customer_email = ${order?.customer?.email || null},
          customer_phone = ${phone},
          customer_wa_id = ${normalizeWaId(phone)},
          status = ${normalizeOrderStatus(order?.status)},
          financial_status = ${normalizeFinancialStatus(order?.orderPaymentStatus)},
          fulfillment_status = ${normalizeFulfillmentStatus(order?.orderPackageStatus)},
          currency = ${order?.currencyCode || 'TRY'},
          subtotal_amount = ${numberOr(order?.totalPrice)},
          discount_amount = 0,
          shipping_amount = ${numberOr(shippingLine?.finalPrice ?? shippingLine?.price)},
          tax_amount = 0,
          total_amount = ${numberOr(order?.totalFinalPrice ?? order?.totalPrice)},
          payment_method = ${payment?.paymentGatewayName || payment?.type || null},
          shipping_method = ${shippingLine?.title || null},
          cargo_company = ${tracking?.cargoCompany || null},
          tracking_number = ${tracking?.trackingNumber || null},
          tracking_url = ${tracking?.trackingLink || null},
          note = ${order?.note || null},
          ordered_at = ${orderedAt},
          updated_at = ${updatedAt}
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
          ${order?.customer?.email || null}, ${phone}, ${normalizeWaId(phone)}, ${normalizeOrderStatus(order?.status)},
          ${normalizeFinancialStatus(order?.orderPaymentStatus)}, ${normalizeFulfillmentStatus(order?.orderPackageStatus)}, ${order?.currencyCode || 'TRY'},
          ${numberOr(order?.totalPrice)}, 0, ${numberOr(shippingLine?.finalPrice ?? shippingLine?.price)}, 0,
          ${numberOr(order?.totalFinalPrice ?? order?.totalPrice)}, ${payment?.paymentGatewayName || payment?.type || null},
          ${shippingLine?.title || null}, ${tracking?.cargoCompany || null}, ${tracking?.trackingNumber || null},
          ${tracking?.trackingLink || null}, ${order?.note || null}, ${orderedAt}, ${createdAt}, ${updatedAt}
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
      const map = await findVariantMap(tenant.tenantId, variant?.id || null, variant?.sku || null);
      const sku = variant?.sku || null;
      const productName = variant?.name || 'Ürün';
      const quantity = numberOr(item?.quantity, 1);
      const unitPrice = numberOr(item?.finalUnitPrice ?? item?.unitPrice ?? item?.price);

      await prisma.$executeRaw`
        insert into public.commerce_order_items (
          tenant_id, order_id, product_id, variant_id, sku, product_name, variant_title, color, size, quantity,
          currency, unit_price, discount_amount, total_amount, fulfillment_status, return_status
        ) values (
          CAST(${tenant.tenantId} AS uuid), CAST(${orderId} AS uuid), CAST(${map.product_id} AS uuid), CAST(${map.variant_id} AS uuid),
          ${sku}, ${productName}, null, ${colorFromText(productName, sku)}, ${sizeFromSku(sku)}, ${quantity},
          ${item?.currencyCode || order?.currencyCode || 'TRY'}, ${unitPrice}, ${numberOr(item?.discountPrice)},
          ${numberOr(item?.finalPrice ?? item?.price, unitPrice * quantity)}, ${normalizeFulfillmentStatus(item?.status)}, null
        )
      `;
    }

    syncedOrders.push({ orderNo, orderId, action, itemCount: items.length });
  }

  return {
    tenant,
    sourceCount: numberOr(response?.data?.listOrder?.count),
    fetchedCount: orders.length,
    syncedCount: syncedOrders.length,
    syncedOrders,
  };
}

export async function listActiveIkasOrderSyncIdentities(): Promise<SyncIdentity[]> {
  const tokens = await AuthTokenManager.list();
  return tokens
    .filter((item) => !item.deleted && item.accessToken && item.merchantId && item.authorizedAppId)
    .map((item) => ({ merchantId: item.merchantId!, authorizedAppId: item.authorizedAppId! }));
}
