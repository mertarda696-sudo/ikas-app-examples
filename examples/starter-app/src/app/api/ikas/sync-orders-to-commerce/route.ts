import { onCheckToken } from '@/helpers/api-helpers';
import { config } from '@/globals/config';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getTenantPanelContextByMerchantId } from '@/lib/apparel-panel/queries';
import { prisma } from '@/lib/prisma';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

type ExistingOrderRow = {
  id: string;
};

type VariantMapRow = {
  product_id: string | null;
  variant_id: string | null;
};

type SyncedOrderResult = {
  externalOrderId: string;
  orderNo: string | null;
  orderId: string;
  action: 'created' | 'updated';
  itemCount: number;
};

const ORDER_LIMIT = 25;

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
}

function normalizePhoneForWaId(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) return null;
  if (digits.startsWith('90')) return digits;
  if (digits.startsWith('0')) return '9' + digits;
  if (digits.length === 10 && digits.startsWith('5')) return '90' + digits;

  return digits;
}

function timestampToDate(value: unknown): Date | null {
  if (value == null) return null;

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const milliseconds = numeric > 9999999999 ? numeric : numeric * 1000;
  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOrderStatus(value: string | null | undefined) {
  const status = normalizeText(value).toUpperCase();

  if (['CREATED', 'APPROVED', 'OPEN'].includes(status)) return 'confirmed';
  if (['PENDING', 'DRAFT'].includes(status)) return 'pending';
  if (['PROCESSING', 'PREPARING'].includes(status)) return 'processing';
  if (['SHIPPED'].includes(status)) return 'shipped';
  if (['DELIVERED', 'COMPLETED'].includes(status)) return 'delivered';
  if (['CANCELLED', 'CANCELED'].includes(status)) return 'canceled';
  if (['REFUNDED'].includes(status)) return 'refunded';

  return status ? status.toLocaleLowerCase('tr-TR') : 'pending';
}

function normalizeFinancialStatus(value: string | null | undefined) {
  const status = normalizeText(value).toUpperCase();

  if (['PAID', 'SUCCESS'].includes(status)) return 'paid';
  if (['PARTIALLY_PAID', 'PARTIAL_PAID'].includes(status)) return 'partially_paid';
  if (['WAITING', 'PENDING', 'UNPAID'].includes(status)) return 'pending';
  if (['REFUNDED'].includes(status)) return 'refunded';
  if (['VOIDED', 'CANCELLED', 'CANCELED'].includes(status)) return 'voided';

  return status ? status.toLocaleLowerCase('tr-TR') : 'pending';
}

function normalizeFulfillmentStatus(value: string | null | undefined) {
  const status = normalizeText(value).toUpperCase();

  if (['UNFULFILLED', 'CREATED', 'WAITING'].includes(status)) return 'unfulfilled';
  if (['PARTIALLY_FULFILLED', 'PARTIAL'].includes(status)) return 'partial';
  if (['FULFILLED', 'DELIVERED', 'COMPLETED'].includes(status)) return 'fulfilled';
  if (['SHIPPED'].includes(status)) return 'shipped';
  if (['CANCELLED', 'CANCELED'].includes(status)) return 'canceled';
  if (['RETURNED', 'REFUNDED'].includes(status)) return 'returned';

  return status ? status.toLocaleLowerCase('tr-TR') : 'unfulfilled';
}

function extractSizeFromSku(value: string | null | undefined) {
  const normalized = normalizeText(value).toUpperCase();
  const parts = normalized.split('-').filter(Boolean);
  const last = parts[parts.length - 1];

  if (['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'].includes(last)) {
    return last;
  }

  return null;
}

function extractColorFromText(...values: Array<string | null | undefined>) {
  const merged = normalizeText(values.filter(Boolean).join(' '));
  const colorAliases: Array<[string, string]> = [
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
    ['yesil', 'yeşil'],
    ['yeşil', 'yeşil'],
  ];

  for (const [needle, canonical] of colorAliases) {
    if (merged.includes(normalizeText(needle))) return canonical;
  }

  return null;
}

function optionValueSummary(options: any[] | null | undefined) {
  if (!Array.isArray(options)) return null;

  const parts = options
    .map((option) => {
      const name = option?.name || '';
      const values = Array.isArray(option?.values)
        ? option.values
            .map((value: any) => value?.name || value?.value || '')
            .filter(Boolean)
            .join(', ')
        : '';

      return [name, values].filter(Boolean).join(': ');
    })
    .filter(Boolean);

  return parts.length ? parts.join(' / ') : null;
}

async function ikasGraphQL<T>(accessToken: string, query: string): Promise<T> {
  if (!config.graphApiUrl) {
    throw new Error('Graph API URL not configured');
  }

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
    throw new Error(
      body?.errors?.[0]?.message ||
        body?.errors?.[0]?.extensions?.code ||
        'GraphQL request failed with status ' + response.status,
    );
  }

  return body as T;
}

async function getIkasAccessToken(authorizedAppId: string) {
  const authToken = await AuthTokenManager.get(authorizedAppId);

  if (!authToken?.accessToken) {
    throw new Error('MIRELLE ikas OAuth token kaydı bulunamadı.');
  }

  const expireTime = new Date(authToken.expireDate).getTime();
  const tokenExpired = Number.isFinite(expireTime) && expireTime <= Date.now() + 60 * 1000;
  const refreshedTokenResult = await onCheckToken(authToken);

  const ikasAccessToken =
    refreshedTokenResult.accessToken ||
    (!tokenExpired ? authToken.accessToken : null);

  if (!ikasAccessToken) {
    throw new Error('IKAS_TOKEN_REFRESH_FAILED');
  }

  return ikasAccessToken;
}

async function findVariantMap(tenantId: string, externalVariantId: string | null | undefined): Promise<VariantMapRow> {
  if (!externalVariantId) {
    return { product_id: null, variant_id: null };
  }

  const rows = await prisma.$queryRaw<VariantMapRow[]>`
    select product_id, id as variant_id
    from public.product_variants
    where tenant_id = CAST(${tenantId} AS uuid)
      and external_variant_id = ${externalVariantId}
    limit 1
  `;

  return rows[0] || { product_id: null, variant_id: null };
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId || !user?.authorizedAppId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          syncedOrders: [],
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          syncedOrders: [],
          error: 'Tenant not found for merchant',
        },
        { status: 404 },
      );
    }

    const ikasAccessToken = await getIkasAccessToken(user.authorizedAppId);

    const query = `
      query IkasOrderSync {
        listOrder(pagination: { page: 1, limit: ${ORDER_LIMIT} }, sort: "orderedAt:desc") {
          count
          hasNext
          page
          limit
          data {
            id
            orderNumber
            status
            orderPaymentStatus
            orderPackageStatus
            orderedAt
            createdAt
            updatedAt
            cancelledAt
            currencyCode
            totalPrice
            totalFinalPrice
            itemCount
            note
            customerId
            customer {
              id
              fullName
              firstName
              lastName
              email
              phone
              isGuestCheckout
            }
            paymentMethods {
              type
              paymentGatewayName
              paymentGatewayCode
              price
            }
            shippingLines {
              title
              price
              finalPrice
              cargoCompanyId
              paymentMethod
            }
            orderLineItems {
              id
              quantity
              price
              unitPrice
              finalPrice
              finalUnitPrice
              discountPrice
              currencyCode
              status
              sourceId
              stockLocationId
              variant {
                id
                name
                sku
              }
              options {
                name
                values {
                  name
                  value
                }
              }
            }
            orderPackages {
              id
              orderPackageNumber
              orderPackageFulfillStatus
              sourceId
              trackingInfo {
                trackingNumber
                trackingLink
                cargoCompany
              }
            }
          }
        }
      }
    `;

    const response = await ikasGraphQL<any>(ikasAccessToken, query);
    const orders = Array.isArray(response?.data?.listOrder?.data)
      ? response.data.listOrder.data
      : [];

    const syncedOrders: SyncedOrderResult[] = [];

    for (const order of orders) {
      const externalOrderId = String(order?.id || '').trim();

      if (!externalOrderId) continue;

      const orderNo = String(order?.orderNumber || externalOrderId).trim();
      const customerPhone = order?.customer?.phone || null;
      const paymentMethod = Array.isArray(order?.paymentMethods) && order.paymentMethods.length
        ? order.paymentMethods[0]?.paymentGatewayName || order.paymentMethods[0]?.type || null
        : null;
      const shippingLine = Array.isArray(order?.shippingLines) && order.shippingLines.length
        ? order.shippingLines[0]
        : null;
      const firstPackage = Array.isArray(order?.orderPackages) && order.orderPackages.length
        ? order.orderPackages[0]
        : null;
      const trackingInfo = firstPackage?.trackingInfo || null;

      const existingRows = await prisma.$queryRaw<ExistingOrderRow[]>`
        select id
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and external_order_id = ${externalOrderId}
        limit 1
      `;

      const existingOrder = existingRows[0] || null;
      const orderedAt = timestampToDate(order?.orderedAt) || timestampToDate(order?.createdAt) || new Date();
      const createdAt = timestampToDate(order?.createdAt) || orderedAt;
      const updatedAt = timestampToDate(order?.updatedAt) || new Date();

      let orderId: string;
      let action: 'created' | 'updated';

      if (existingOrder) {
        await prisma.$executeRaw`
          update public.commerce_orders
          set
            order_no = ${orderNo},
            source_platform = 'ikas',
            external_order_id = ${externalOrderId},
            customer_name = ${order?.customer?.fullName || null},
            customer_email = ${order?.customer?.email || null},
            customer_phone = ${customerPhone},
            customer_wa_id = ${normalizePhoneForWaId(customerPhone)},
            status = ${normalizeOrderStatus(order?.status)},
            financial_status = ${normalizeFinancialStatus(order?.orderPaymentStatus)},
            fulfillment_status = ${normalizeFulfillmentStatus(order?.orderPackageStatus)},
            currency = ${order?.currencyCode || 'TRY'},
            subtotal_amount = ${toNumber(order?.totalPrice)},
            discount_amount = 0,
            shipping_amount = ${toNumber(shippingLine?.finalPrice ?? shippingLine?.price)},
            tax_amount = 0,
            total_amount = ${toNumber(order?.totalFinalPrice ?? order?.totalPrice)},
            payment_method = ${paymentMethod},
            shipping_method = ${shippingLine?.title || null},
            cargo_company = ${trackingInfo?.cargoCompany || null},
            tracking_number = ${trackingInfo?.trackingNumber || null},
            tracking_url = ${trackingInfo?.trackingLink || null},
            note = ${order?.note || null},
            ordered_at = ${orderedAt},
            updated_at = ${updatedAt}
          where id = CAST(${existingOrder.id} AS uuid)
        `;

        orderId = existingOrder.id;
        action = 'updated';
      } else {
        const insertedRows = await prisma.$queryRaw<ExistingOrderRow[]>`
          insert into public.commerce_orders (
            tenant_id,
            order_no,
            source_platform,
            external_order_id,
            customer_name,
            customer_email,
            customer_phone,
            customer_wa_id,
            status,
            financial_status,
            fulfillment_status,
            currency,
            subtotal_amount,
            discount_amount,
            shipping_amount,
            tax_amount,
            total_amount,
            payment_method,
            shipping_method,
            cargo_company,
            tracking_number,
            tracking_url,
            note,
            ordered_at,
            created_at,
            updated_at
          )
          values (
            CAST(${tenant.tenantId} AS uuid),
            ${orderNo},
            'ikas',
            ${externalOrderId},
            ${order?.customer?.fullName || null},
            ${order?.customer?.email || null},
            ${customerPhone},
            ${normalizePhoneForWaId(customerPhone)},
            ${normalizeOrderStatus(order?.status)},
            ${normalizeFinancialStatus(order?.orderPaymentStatus)},
            ${normalizeFulfillmentStatus(order?.orderPackageStatus)},
            ${order?.currencyCode || 'TRY'},
            ${toNumber(order?.totalPrice)},
            0,
            ${toNumber(shippingLine?.finalPrice ?? shippingLine?.price)},
            0,
            ${toNumber(order?.totalFinalPrice ?? order?.totalPrice)},
            ${paymentMethod},
            ${shippingLine?.title || null},
            ${trackingInfo?.cargoCompany || null},
            ${trackingInfo?.trackingNumber || null},
            ${trackingInfo?.trackingLink || null},
            ${order?.note || null},
            ${orderedAt},
            ${createdAt},
            ${updatedAt}
          )
          returning id
        `;

        orderId = insertedRows[0]?.id;
        action = 'created';
      }

      if (!orderId) {
        throw new Error('Order insert/update returned no id for external order ' + externalOrderId);
      }

      await prisma.$executeRaw`
        delete from public.commerce_order_items
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and order_id = CAST(${orderId} AS uuid)
      `;

      const orderLineItems = Array.isArray(order?.orderLineItems) ? order.orderLineItems : [];

      for (const item of orderLineItems) {
        const variant = item?.variant || null;
        const variantMap = await findVariantMap(tenant.tenantId, variant?.id || null);
        const optionsSummary = optionValueSummary(item?.options);
        const sku = variant?.sku || null;
        const productName = variant?.name || 'Ürün';
        const size = extractSizeFromSku(sku) || null;
        const color = extractColorFromText(productName, sku);
        const quantity = toNumber(item?.quantity, 1);
        const unitPrice = toNullableNumber(item?.finalUnitPrice ?? item?.unitPrice ?? item?.price) ?? 0;
        const totalAmount = toNumber(item?.finalPrice ?? item?.price, unitPrice * quantity);

        await prisma.$executeRaw`
          insert into public.commerce_order_items (
            tenant_id,
            order_id,
            product_id,
            variant_id,
            sku,
            product_name,
            variant_title,
            color,
            size,
            quantity,
            currency,
            unit_price,
            discount_amount,
            total_amount,
            fulfillment_status,
            return_status
          )
          values (
            CAST(${tenant.tenantId} AS uuid),
            CAST(${orderId} AS uuid),
            ${variantMap.product_id ? Prisma.sql`CAST(${variantMap.product_id} AS uuid)` : null},
            ${variantMap.variant_id ? Prisma.sql`CAST(${variantMap.variant_id} AS uuid)` : null},
            ${sku},
            ${productName},
            ${optionsSummary},
            ${color},
            ${size},
            ${quantity},
            ${item?.currencyCode || order?.currencyCode || 'TRY'},
            ${unitPrice},
            ${toNumber(item?.discountPrice)},
            ${totalAmount},
            ${normalizeFulfillmentStatus(item?.status)},
            null
          )
        `;
      }

      syncedOrders.push({
        externalOrderId,
        orderNo,
        orderId,
        action,
        itemCount: orderLineItems.length,
      });
    }

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      tenant,
      sourceCount: toNumber(response?.data?.listOrder?.count),
      fetchedCount: orders.length,
      syncedCount: syncedOrders.length,
      syncedOrders,
      error: null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        syncedOrders: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
