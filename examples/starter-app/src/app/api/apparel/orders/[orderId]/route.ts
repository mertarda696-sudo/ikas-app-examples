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
  shipping_address_json: unknown | null;
  billing_address_json: unknown | null;
  note: string | null;
  tags: string[] | null;
  conversation_id: string | null;
  member_id: string | null;
  ordered_at: Date | string | null;
  paid_at: Date | string | null;
  fulfilled_at: Date | string | null;
  canceled_at: Date | string | null;
  delivered_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type OrderItemRow = {
  id: string;
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
  description: string | null;
  priority: string | null;
  status: string | null;
  linked_order_id: string | null;
  conversation_id: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type ConversationRow = {
  id: string;
  status: string | null;
  channel: string | null;
  last_message_at: Date | string | null;
  context_product_name: string | null;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          order: null,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { orderId } = await params;
    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          order: null,
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const orderRows = await prisma.$queryRaw<OrderRow[]>`
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
        shipping_address_json,
        billing_address_json,
        note,
        tags,
        conversation_id,
        member_id,
        ordered_at,
        paid_at,
        fulfilled_at,
        canceled_at,
        delivered_at,
        created_at,
        updated_at
      from public.commerce_orders
      where tenant_id = CAST(${tenant.tenantId} AS uuid)
        and (
          id::text = ${orderId}
          or order_no = ${orderId}
        )
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      return NextResponse.json(
        {
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant,
          order: null,
          error: "Order not found for merchant",
        },
        { status: 404 },
      );
    }

    const [itemRows, caseRows, conversationRows] = await Promise.all([
      prisma.$queryRaw<OrderItemRow[]>`
        select
          id,
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
        from public.commerce_order_items
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and order_id = CAST(${order.id} AS uuid)
        order by created_at asc, id asc
      `,
            prisma.$queryRaw<LinkedCaseRow[]>`
        select
          id,
          case_no,
          case_type,
          title,
          description,
          priority,
          status,
          linked_order_id,
          conversation_id,
          created_at,
          updated_at
        from public.operation_cases
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
          and linked_order_id = ${order.order_no}
        order by
          case
            when priority = 'critical' then 4
            when priority = 'high' then 3
            when priority = 'normal' then 2
            when priority = 'low' then 1
            else 0
          end desc,
          updated_at desc nulls last,
          created_at desc nulls last
        limit 20
      `,
      order.conversation_id
        ? prisma.$queryRaw<ConversationRow[]>`
            select
              id,
              status,
              channel,
              last_message_at,
              context_product_name
            from public.conversations
            where tenant_id = CAST(${tenant.tenantId} AS uuid)
              and id = CAST(${order.conversation_id} AS uuid)
            limit 1
          `
        : Promise.resolve([]),
    ]);

        const itemsSubtotalAmount = itemRows.reduce((sum, item) => {
      return sum + toNumber(item.total_amount);
    }, 0);

    const safeSubtotalAmount =
      toNumber(order.subtotal_amount) > 0
        ? toNumber(order.subtotal_amount)
        : itemsSubtotalAmount;
    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        order: {
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
          subtotalAmount: safeSubtotalAmount,
          discountAmount: toNumber(order.discount_amount),
          shippingAmount: toNumber(order.shipping_amount),
          taxAmount: toNumber(order.tax_amount),
          totalAmount: toNumber(order.total_amount),
          paymentMethod: order.payment_method,
          shippingMethod: order.shipping_method,
          cargoCompany: order.cargo_company,
          trackingNumber: order.tracking_number,
          trackingUrl: order.tracking_url,
          shippingAddress: order.shipping_address_json,
          billingAddress: order.billing_address_json,
          note: order.note,
          tags: order.tags || [],
          conversationId: order.conversation_id,
          memberId: order.member_id,
          orderedAt: toIso(order.ordered_at),
          paidAt: toIso(order.paid_at),
          fulfilledAt: toIso(order.fulfilled_at),
          canceledAt: toIso(order.canceled_at),
          deliveredAt: toIso(order.delivered_at),
          createdAt: toIso(order.created_at),
          updatedAt: toIso(order.updated_at),
          items: itemRows.map((item) => ({
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
          linkedConversation: conversationRows[0]
            ? {
                id: conversationRows[0].id,
                status: conversationRows[0].status,
                channel: conversationRows[0].channel,
                lastMessageAt: toIso(conversationRows[0].last_message_at),
                contextProductName: conversationRows[0].context_product_name,
              }
            : null,
          linkedOperationCases: caseRows.map((caseItem) => ({
            id: caseItem.id,
            caseNo: caseItem.case_no,
            caseType: caseItem.case_type,
            title: caseItem.title,
            description: caseItem.description,
            priority: caseItem.priority,
            status: caseItem.status,
            linkedOrderId: caseItem.linked_order_id,
            conversationId: caseItem.conversation_id,
            createdAt: toIso(caseItem.created_at),
            updatedAt: toIso(caseItem.updated_at),
          })),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        order: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
