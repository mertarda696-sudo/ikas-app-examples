import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type OrderStatusBody = {
  status?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  shippingMethod?: string;
  cargoCompany?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  note?: string;
};

type UpdatedOrderRow = {
  id: string;
  order_no: string;
  status: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  cargo_company: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_method: string | null;
  note: string | null;
  paid_at: Date | string | null;
  fulfilled_at: Date | string | null;
  canceled_at: Date | string | null;
  delivered_at: Date | string | null;
  updated_at: Date | string | null;
};

const ALLOWED_ORDER_STATUSES = new Set([
  "draft",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "canceled",
  "returned",
  "partially_returned",
]);

const ALLOWED_FINANCIAL_STATUSES = new Set([
  "unknown",
  "pending",
  "paid",
  "partially_paid",
  "refunded",
  "partially_refunded",
  "failed",
  "voided",
]);

const ALLOWED_FULFILLMENT_STATUSES = new Set([
  "unfulfilled",
  "partial",
  "fulfilled",
  "returned",
  "canceled",
]);

function normalizeEnum(value: string | undefined, allowed: Set<string>) {
  const normalized = String(value || "").trim();
  return allowed.has(normalized) ? normalized : null;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const user = getUserFromRequest(request);

    if (!user?.merchantId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { orderId } = await params;
    const body = (await request.json().catch(() => ({}))) as OrderStatusBody;

    const tenant = await getTenantPanelContextByMerchantId(user.merchantId);

    if (!tenant) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const nextStatus = normalizeEnum(body.status, ALLOWED_ORDER_STATUSES);
    const nextFinancialStatus = normalizeEnum(body.financialStatus, ALLOWED_FINANCIAL_STATUSES);
    const nextFulfillmentStatus = normalizeEnum(body.fulfillmentStatus, ALLOWED_FULFILLMENT_STATUSES);

    if (body.status !== undefined && !nextStatus) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid order status",
          allowedStatuses: Array.from(ALLOWED_ORDER_STATUSES),
        },
        { status: 400 },
      );
    }

    if (body.financialStatus !== undefined && !nextFinancialStatus) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid financial status",
          allowedStatuses: Array.from(ALLOWED_FINANCIAL_STATUSES),
        },
        { status: 400 },
      );
    }

    if (body.fulfillmentStatus !== undefined && !nextFulfillmentStatus) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid fulfillment status",
          allowedStatuses: Array.from(ALLOWED_FULFILLMENT_STATUSES),
        },
        { status: 400 },
      );
    }

    if (
      body.status === undefined &&
      body.financialStatus === undefined &&
      body.fulfillmentStatus === undefined &&
      body.shippingMethod === undefined &&
      body.cargoCompany === undefined &&
      body.trackingNumber === undefined &&
      body.trackingUrl === undefined &&
      body.note === undefined
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "No update fields provided",
        },
        { status: 400 },
      );
    }

    const shippingMethod = normalizeOptionalText(body.shippingMethod);
    const cargoCompany = normalizeOptionalText(body.cargoCompany);
    const trackingNumber = normalizeOptionalText(body.trackingNumber);
    const trackingUrl = normalizeOptionalText(body.trackingUrl);
    const note = normalizeOptionalText(body.note);

    const rows = await prisma.$queryRaw<UpdatedOrderRow[]>`
      update public.commerce_orders
      set
        status = coalesce(${nextStatus}, status),
        financial_status = coalesce(${nextFinancialStatus}, financial_status),
        fulfillment_status = coalesce(${nextFulfillmentStatus}, fulfillment_status),
        shipping_method = case when ${body.shippingMethod !== undefined} then ${shippingMethod} else shipping_method end,
        cargo_company = case when ${body.cargoCompany !== undefined} then ${cargoCompany} else cargo_company end,
        tracking_number = case when ${body.trackingNumber !== undefined} then ${trackingNumber} else tracking_number end,
        tracking_url = case when ${body.trackingUrl !== undefined} then ${trackingUrl} else tracking_url end,
        note = case when ${body.note !== undefined} then ${note} else note end,
        paid_at = case
          when ${nextFinancialStatus} in ('paid', 'partially_paid') then coalesce(paid_at, now())
          when ${nextFinancialStatus} in ('pending', 'failed', 'voided', 'unknown') then null
          else paid_at
        end,
        fulfilled_at = case
          when ${nextFulfillmentStatus} = 'fulfilled' then coalesce(fulfilled_at, now())
          when ${nextFulfillmentStatus} in ('unfulfilled', 'partial') then null
          else fulfilled_at
        end,
        delivered_at = case
          when ${nextStatus} = 'delivered' then coalesce(delivered_at, now())
          when ${nextStatus} in ('pending', 'confirmed', 'processing', 'shipped') then null
          else delivered_at
        end,
        canceled_at = case
          when ${nextStatus} = 'canceled' then coalesce(canceled_at, now())
          when ${nextStatus} in ('pending', 'confirmed', 'processing', 'shipped', 'delivered') then null
          else canceled_at
        end,
        updated_at = now()
      where tenant_id = CAST(${tenant.tenantId} AS uuid)
        and (
          id::text = ${orderId}
          or order_no = ${orderId}
        )
      returning
        id,
        order_no,
        status,
        financial_status,
        fulfillment_status,
        cargo_company,
        tracking_number,
        tracking_url,
        shipping_method,
        note,
        paid_at,
        fulfilled_at,
        canceled_at,
        delivered_at,
        updated_at
    `;

    const row = rows[0];

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          error: "Order not found for merchant",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        order: {
          id: row.id,
          orderNo: row.order_no,
          status: row.status,
          financialStatus: row.financial_status,
          fulfillmentStatus: row.fulfillment_status,
          cargoCompany: row.cargo_company,
          trackingNumber: row.tracking_number,
          trackingUrl: row.tracking_url,
          shippingMethod: row.shipping_method,
          note: row.note,
          paidAt: toIso(row.paid_at),
          fulfilledAt: toIso(row.fulfilled_at),
          canceledAt: toIso(row.canceled_at),
          deliveredAt: toIso(row.delivered_at),
          updatedAt: toIso(row.updated_at),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
