import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OrderRow = {
  id: string;
  order_no: string;
  source_platform: string | null;
  external_order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_wa_id: string | null;
  status: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  currency: string | null;
  subtotal_amount: number | string | null;
  discount_amount: number | string | null;
  shipping_amount: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  payment_method: string | null;
  shipping_method: string | null;
  cargo_company: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  note: string | null;
  conversation_id: string | null;
  ordered_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string | null;
  product_name: string;
  variant_title: string | null;
  color: string | null;
  size: string | null;
  quantity: number | string | null;
  currency: string | null;
  unit_price: number | string | null;
  discount_amount: number | string | null;
  total_amount: number | string | null;
  fulfillment_status: string | null;
  return_status: string | null;
};

type LinkedCaseRow = {
  id: string;
  case_no: string | null;
  case_type: string | null;
  title: string | null;
  priority: string | null;
  status: string | null;
  linked_order_id: string | null;
  conversation_id: string | null;
  updated_at: Date | string | null;
  created_at: Date | string | null;
};

type CountRow = {
  count: number | string | null;
};

type SumRow = {
  amount: number | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          metrics: {
            total: 0,
            active: 0,
            paid: 0,
            unfulfilled: 0,
            totalRevenue: 0,
          },
          items: [],
          error: "Unauthorized",
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
          metrics: {
            total: 0,
            active: 0,
            paid: 0,
            unfulfilled: 0,
            totalRevenue: 0,
          },
          items: [],
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const [orders, orderItems, linkedCaseRows, totalRows, activeRows, paidRows, unfulfilledRows, revenueRows] = await Promise.all([
      prisma.$queryRaw<OrderRow[]>`
        select
          id,
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
          conversation_id,
          ordered_at,
          created_at,
          updated_at
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
        order by ordered_at desc nulls last, created_at desc nulls last
        limit 100
      `,
      prisma.$queryRaw<OrderItemRow[]>`
        select
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.variant_id,
          oi.sku,
          oi.product_name,
          oi.variant_title,
          oi.color,
          oi.size,
          oi.quantity,
          oi.currency,
          oi.unit_price,
          oi.discount_amount,
          oi.total_amount,
          oi.fulfillment_status,
          oi.return_status
        from public.commerce_order_items oi
        inner join public.commerce_orders o on o.id = oi.order_id
        where oi.tenant_id = CAST(${tenant.tenantId} AS uuid)
          and o.tenant_id = CAST(${tenant.tenantId} AS uuid)
        order by oi.created_at asc, oi.id asc
        limit 500
      `,
      prisma.$queryRaw<LinkedCaseRow[]>`
        select
          oc.id,
          oc.case_no,
          oc.case_type,
          oc.title,
          oc.priority,
          oc.status,
          oc.linked_order_id,
          oc.conversation_id,
          oc.updated_at,
          oc.created_at
        from public.operation_cases oc
        where oc.tenant_id = CAST(${tenant.tenantId} AS uuid)
          and oc.linked_order_id is not null
        order by
          case
            when oc.priority = 'critical' then 4
            when oc.priority = 'high' then 3
            when oc.priority = 'normal' then 2
            when oc.priority = 'low' then 1
            else 0
          end desc,
          oc.updated_at desc nulls last,
          oc.created_at desc nulls last
        limit 300
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and status in ('pending', 'confirmed', 'processing', 'shipped')
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and financial_status in ('paid', 'partially_paid')
      `,
      prisma.$queryRaw<CountRow[]>`
        select count(*)::int as count
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and fulfillment_status in ('unfulfilled', 'partial')
      `,
      prisma.$queryRaw<SumRow[]>`
        select coalesce(sum(total_amount), 0) as amount
        from public.commerce_orders
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and financial_status in ('paid', 'partially_paid')
          and status not in ('canceled')
      `,
    ]);

    const itemsByOrderId = new Map<string, OrderItemRow[]>();

    for (const item of orderItems) {
      const existing = itemsByOrderId.get(item.order_id) || [];
      existing.push(item);
      itemsByOrderId.set(item.order_id, existing);
    }

    const casesByOrderKey = new Map<string, LinkedCaseRow[]>();

    for (const caseItem of linkedCaseRows) {
      const key = String(caseItem.linked_order_id || '').trim();
      if (!key) continue;

      const existing = casesByOrderKey.get(key) || [];
      existing.push(caseItem);
      casesByOrderKey.set(key, existing);
    }

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        metrics: {
          total: toNumber(totalRows[0]?.count),
          active: toNumber(activeRows[0]?.count),
          paid: toNumber(paidRows[0]?.count),
          unfulfilled: toNumber(unfulfilledRows[0]?.count),
          totalRevenue: toNumber(revenueRows[0]?.amount),
        },
        items: orders.map((order) => ({
          id: order.id,
          orderNo: order.order_no,
          sourcePlatform: order.source_platform,
          externalOrderId: order.external_order_id,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          customerWaId: order.customer_wa_id,
          status: order.status,
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
          currency: order.currency,
          subtotalAmount: toNumber(order.subtotal_amount),
          discountAmount: toNumber(order.discount_amount),
          shippingAmount: toNumber(order.shipping_amount),
          taxAmount: toNumber(order.tax_amount),
          totalAmount: toNumber(order.total_amount),
          paymentMethod: order.payment_method,
          shippingMethod: order.shipping_method,
          cargoCompany: order.cargo_company,
          trackingNumber: order.tracking_number,
          trackingUrl: order.tracking_url,
          note: order.note,
          conversationId: order.conversation_id,
          orderedAt: toIso(order.ordered_at),
          createdAt: toIso(order.created_at),
          updatedAt: toIso(order.updated_at),
          items: (itemsByOrderId.get(order.id) || []).map((item) => ({
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            sku: item.sku,
            productName: item.product_name,
            variantTitle: item.variant_title,
            color: item.color,
            size: item.size,
            quantity: toNumber(item.quantity),
            currency: item.currency,
            unitPrice: toNumber(item.unit_price),
            discountAmount: toNumber(item.discount_amount),
            totalAmount: toNumber(item.total_amount),
            fulfillmentStatus: item.fulfillment_status,
            returnStatus: item.return_status,
          })),
          linkedOperationCases: [
            ...(casesByOrderKey.get(order.order_no) || []),
            ...(casesByOrderKey.get(order.id) || []),
          ].map((caseItem) => ({
            id: caseItem.id,
            caseNo: caseItem.case_no,
            caseType: caseItem.case_type,
            title: caseItem.title,
            priority: caseItem.priority,
            status: caseItem.status,
            linkedOrderId: caseItem.linked_order_id,
            conversationId: caseItem.conversation_id,
            updatedAt: toIso(caseItem.updated_at),
            createdAt: toIso(caseItem.created_at),
          })),
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        metrics: {
          total: 0,
          active: 0,
          paid: 0,
          unfulfilled: 0,
          totalRevenue: 0,
        },
        items: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
