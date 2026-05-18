import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getTenantPanelContextByMerchantId } from "@/lib/apparel-panel/queries";

type MessageLinkRow = {
  id: string;
  message_id: string | null;
  conversation_id: string | null;
  channel: string | null;
  direction: string | null;
  customer_wa_id: string | null;
  original_text: string | null;
  original_url: string | null;
  normalized_url: string | null;
  url_scheme: string | null;
  url_host: string | null;
  url_path: string | null;
  url_query_present: boolean | null;
  link_index: number | string | null;
  link_source: string | null;
  link_type: string | null;
  capture_status: string | null;
  classification_status: string | null;
  detected_intent: string | null;
  detected_customer_intent: string | null;
  is_shortened_url: boolean | null;
  is_tenant_domain: boolean | null;
  is_known_commerce_domain: boolean | null;
  is_potentially_unsafe: boolean | null;
  safety_status: string | null;
  safety_reason: string | null;
  matched_product_id: string | null;
  matched_product_name: string | null;
  linked_order_id: string | null;
  operation_case_id: string | null;
  case_no: string | null;
  meta: unknown;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  message_text: string | null;
  message_from_address: string | null;
  message_to_address: string | null;
  message_created_at: Date | string | null;
  analysis_id: string | null;
  analysis_type: string | null;
  analysis_status: string | null;
  analysis_link_type: string | null;
  analysis_detected_intent: string | null;
  analysis_detected_customer_intent: string | null;
  analysis_summary_text: string | null;
  analysis_confidence: number | string | null;
  analysis_needs_operator_review: boolean | null;
  analysis_safety_status: string | null;
  analysis_safety_reason: string | null;
  analysis_model_provider: string | null;
  analysis_model_name: string | null;
  analysis_created_at: Date | string | null;
  analysis_updated_at: Date | string | null;
  product_match_id: string | null;
  product_match_analysis_status: string | null;
  product_match_detected_intent: string | null;
  product_match_detected_customer_intent: string | null;
  product_match_summary_text: string | null;
  product_match_confidence: number | string | null;
  product_match_needs_operator_review: boolean | null;
  product_match_matched_product_id: string | null;
  product_match_matched_product_name: string | null;
  product_match_created_at: Date | string | null;
  product_match_updated_at: Date | string | null;
};

type MetricsRow = {
  total: number | string | null;
  captured: number | string | null;
  safety_review: number | string | null;
  unsafe: number | string | null;
  shortened: number | string | null;
  product_links: number | string | null;
  social_links: number | string | null;
  tracking_links: number | string | null;
  unknown_links: number | string | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toMetaObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getMetaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function toBoolean(value: boolean | null | undefined): boolean {
  return value === true;
}

function mapLinkTypeLabel(type: string | null | undefined) {
  if (type === "product_link") return "Ürün linki";
  if (type === "social_media_link") return "Sosyal medya linki";
  if (type === "tracking_link") return "Kargo / takip linki";
  if (type === "unsafe_link") return "Güvensiz link";
  if (type === "unknown_link") return "Genel link";
  return type || "Link";
}

function mapCaptureStatusLabel(status: string | null | undefined) {
  if (status === "captured") return "Yakalandı";
  if (status === "safety_review") return "Güvenlik incelemesi";
  if (status === "invalid_url") return "Geçersiz URL";
  if (status === "failed") return "İşleme hatası";
  return status || "Durum bilinmiyor";
}

function mapClassificationStatusLabel(status: string | null | undefined) {
  if (status === "pending") return "Sınıflandırma bekliyor";
  if (status === "classified") return "Sınıflandırıldı";
  if (status === "skipped") return "Atlandı";
  if (status === "failed") return "Sınıflandırma hatası";
  return status || "Durum bilinmiyor";
}

function mapAnalysisStatusLabel(status: string | null | undefined) {
  if (status === "completed") return "Analiz tamamlandı";
  if (status === "pending") return "Analiz bekliyor";
  if (status === "failed") return "Analiz hatası";
  if (status === "skipped") return "Analiz atlandı";
  return status || "Analiz yok";
}

function mapSafetyStatusLabel(status: string | null | undefined) {
  if (status === "unchecked") return "Kontrol edilmedi";
  if (status === "safe") return "Güvenli";
  if (status === "review") return "İnceleme gerekli";
  if (status === "unsafe") return "Güvensiz";
  return status || "Durum bilinmiyor";
}

function inferRiskLevel(row: MessageLinkRow) {
  if (row.safety_status === "unsafe" || row.is_potentially_unsafe) return "unsafe";
  if (row.capture_status === "safety_review" || row.safety_status === "review") return "review";
  if (row.is_shortened_url) return "review";
  return "normal";
}

function mapRow(row: MessageLinkRow) {
  const meta = toMetaObject(row.meta);
  const customerWaId =
    row.customer_wa_id ||
    row.message_from_address ||
    getMetaString(meta, "customer_wa_id") ||
    null;

  const conversationId =
    row.conversation_id ||
    getMetaString(meta, "conversation_id") ||
    null;

  return {
    id: row.id,
    messageId: row.message_id,
    conversationId,
    channel: row.channel,
    direction: row.direction,
    customerWaId,
    originalText: row.original_text,
    messageText: row.message_text,
    originalUrl: row.original_url,
    normalizedUrl: row.normalized_url,
    urlScheme: row.url_scheme,
    urlHost: row.url_host,
    urlPath: row.url_path,
    urlQueryPresent: toBoolean(row.url_query_present),
    linkIndex: toNullableNumber(row.link_index),
    linkSource: row.link_source,
    linkType: row.link_type,
    linkTypeLabel: mapLinkTypeLabel(row.link_type),
    captureStatus: row.capture_status,
    captureStatusLabel: mapCaptureStatusLabel(row.capture_status),
    classificationStatus: row.classification_status,
    classificationStatusLabel: mapClassificationStatusLabel(row.classification_status),
    detectedIntent: row.detected_intent,
    detectedCustomerIntent: row.detected_customer_intent,
    isShortenedUrl: toBoolean(row.is_shortened_url),
    isTenantDomain: toBoolean(row.is_tenant_domain),
    isKnownCommerceDomain: toBoolean(row.is_known_commerce_domain),
    isPotentiallyUnsafe: toBoolean(row.is_potentially_unsafe),
    safetyStatus: row.safety_status,
    safetyStatusLabel: mapSafetyStatusLabel(row.safety_status),
    safetyReason: row.safety_reason,
    riskLevel: inferRiskLevel(row),
    matchedProductId: row.matched_product_id,
    matchedProductName: row.matched_product_name,
    linkedOrderId: row.linked_order_id,
    operationCaseId: row.operation_case_id,
    caseNo: row.case_no,
    meta,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    messageCreatedAt: toIso(row.message_created_at),
    analysis: row.analysis_id
      ? {
          id: row.analysis_id,
          analysisType: row.analysis_type,
          analysisStatus: row.analysis_status,
          analysisStatusLabel: mapAnalysisStatusLabel(row.analysis_status),
          linkType: row.analysis_link_type,
          linkTypeLabel: mapLinkTypeLabel(row.analysis_link_type),
          detectedIntent: row.analysis_detected_intent,
          detectedCustomerIntent: row.analysis_detected_customer_intent,
          summaryText: row.analysis_summary_text,
          confidence: toNullableNumber(row.analysis_confidence),
          needsOperatorReview: toBoolean(row.analysis_needs_operator_review),
          safetyStatus: row.analysis_safety_status,
          safetyStatusLabel: mapSafetyStatusLabel(row.analysis_safety_status),
          safetyReason: row.analysis_safety_reason,
          modelProvider: row.analysis_model_provider,
          modelName: row.analysis_model_name,
          createdAt: toIso(row.analysis_created_at),
          updatedAt: toIso(row.analysis_updated_at),
        }
      : null,
        productMatch: row.product_match_id
      ? {
          id: row.product_match_id,
          analysisStatus: row.product_match_analysis_status,
          analysisStatusLabel: mapAnalysisStatusLabel(row.product_match_analysis_status),
          detectedIntent: row.product_match_detected_intent,
          detectedCustomerIntent: row.product_match_detected_customer_intent,
          summaryText: row.product_match_summary_text,
          confidence: toNullableNumber(row.product_match_confidence),
          needsOperatorReview: toBoolean(row.product_match_needs_operator_review),
          matchedProductId: row.product_match_matched_product_id,
          matchedProductName: row.product_match_matched_product_name,
          createdAt: toIso(row.product_match_created_at),
          updatedAt: toIso(row.product_match_updated_at),
        }
      : null,
  };
}

function emptyMetrics() {
  return {
    total: 0,
    captured: 0,
    safetyReview: 0,
    unsafe: 0,
    shortened: 0,
    productLinks: 0,
    socialLinks: 0,
    trackingLinks: 0,
    unknownLinks: 0,
  };
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
          metrics: emptyMetrics(),
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
          metrics: emptyMetrics(),
          items: [],
          error: "Tenant not found for merchant",
        },
        { status: 404 },
      );
    }

    const [rows, metricsRows] = await Promise.all([
      prisma.$queryRaw<MessageLinkRow[]>`
        select
          ml.id,
          ml.message_id,
          coalesce(ml.conversation_id::text, m.conversation_id::text, ml.meta->>'conversation_id') as conversation_id,
          ml.channel,
          ml.direction,
          ml.customer_wa_id,
          ml.original_text,
          ml.original_url,
          ml.normalized_url,
          ml.url_scheme,
          ml.url_host,
          ml.url_path,
          ml.url_query_present,
          ml.link_index,
          ml.link_source,
          ml.link_type,
          ml.capture_status,
          ml.classification_status,
          ml.detected_intent,
          ml.detected_customer_intent,
          ml.is_shortened_url,
          ml.is_tenant_domain,
          ml.is_known_commerce_domain,
          ml.is_potentially_unsafe,
          ml.safety_status,
          ml.safety_reason,
          ml.matched_product_id,
          ml.matched_product_name,
          ml.linked_order_id,
          ml.operation_case_id,
          ml.case_no,
          ml.meta,
          ml.created_at,
          ml.updated_at,
          m.text_body as message_text,
          m.from_address as message_from_address,
          m.to_address as message_to_address,
          m.created_at as message_created_at,
          la.id as analysis_id,
          la.analysis_type as analysis_type,
          la.analysis_status as analysis_status,
          la.link_type as analysis_link_type,
          la.detected_intent as analysis_detected_intent,
          la.detected_customer_intent as analysis_detected_customer_intent,
          la.summary_text as analysis_summary_text,
          la.confidence as analysis_confidence,
          la.needs_operator_review as analysis_needs_operator_review,
          la.safety_status as analysis_safety_status,
          la.safety_reason as analysis_safety_reason,
          la.model_provider as analysis_model_provider,
          la.model_name as analysis_model_name,
          la.created_at as analysis_created_at,
          la.updated_at as analysis_updated_at,
          la_pm.id as product_match_id,
          la_pm.analysis_status as product_match_analysis_status,
          la_pm.detected_intent as product_match_detected_intent,
          la_pm.detected_customer_intent as product_match_detected_customer_intent,
          la_pm.summary_text as product_match_summary_text,
          la_pm.confidence as product_match_confidence,
          la_pm.needs_operator_review as product_match_needs_operator_review,
          la_pm.matched_product_id as product_match_matched_product_id,
          la_pm.matched_product_name as product_match_matched_product_name,
          la_pm.created_at as product_match_created_at,
          la_pm.updated_at as product_match_updated_at
        from public.message_links ml
                left join public.messages m
          on m.id = ml.message_id
         and m.tenant_id = ml.tenant_id
        left join lateral (
          select
            la.id,
            la.analysis_type,
            la.analysis_status,
            la.link_type,
            la.detected_intent,
            la.detected_customer_intent,
            la.summary_text,
            la.confidence,
            la.needs_operator_review,
            la.safety_status,
            la.safety_reason,
            la.model_provider,
            la.model_name,
            la.created_at,
            la.updated_at
          from public.link_analysis la
          where la.tenant_id = ml.tenant_id
            and la.message_link_id = ml.id
            and la.analysis_type = 'classification'
          order by la.updated_at desc nulls last, la.created_at desc nulls last
          limit 1
                ) la on true
        left join lateral (
          select
            la_pm.id,
            la_pm.analysis_status,
            la_pm.detected_intent,
            la_pm.detected_customer_intent,
            la_pm.summary_text,
            la_pm.confidence,
            la_pm.needs_operator_review,
            la_pm.matched_product_id,
            la_pm.matched_product_name,
            la_pm.created_at,
            la_pm.updated_at
          from public.link_analysis la_pm
          where la_pm.tenant_id = ml.tenant_id
            and la_pm.message_link_id = ml.id
            and la_pm.analysis_type = 'product_matching'
          order by la_pm.updated_at desc nulls last, la_pm.created_at desc nulls last
          limit 1
        ) la_pm on true
        where ml.tenant_id = CAST(${tenant.tenantId} AS uuid)
        order by ml.created_at desc nulls last
        limit 100
      `,
      prisma.$queryRaw<MetricsRow[]>`
        select
          count(*)::int as total,
          count(*) filter (where capture_status = 'captured')::int as captured,
          count(*) filter (where capture_status = 'safety_review')::int as safety_review,
          count(*) filter (where safety_status = 'unsafe' or coalesce(is_potentially_unsafe, false) = true)::int as unsafe,
          count(*) filter (where coalesce(is_shortened_url, false) = true)::int as shortened,
          count(*) filter (where link_type = 'product_link')::int as product_links,
          count(*) filter (where link_type = 'social_media_link')::int as social_links,
          count(*) filter (where link_type = 'tracking_link')::int as tracking_links,
          count(*) filter (where link_type = 'unknown_link')::int as unknown_links
        from public.message_links
        where tenant_id = CAST(${tenant.tenantId} AS uuid)
      `,
    ]);

    const metricsRow = metricsRows[0];

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: new Date().toISOString(),
        tenant,
        metrics: {
          total: toNumber(metricsRow?.total),
          captured: toNumber(metricsRow?.captured),
          safetyReview: toNumber(metricsRow?.safety_review),
          unsafe: toNumber(metricsRow?.unsafe),
          shortened: toNumber(metricsRow?.shortened),
          productLinks: toNumber(metricsRow?.product_links),
          socialLinks: toNumber(metricsRow?.social_links),
          trackingLinks: toNumber(metricsRow?.tracking_links),
          unknownLinks: toNumber(metricsRow?.unknown_links),
        },
        items: rows.map(mapRow),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fetchedAt: new Date().toISOString(),
        tenant: null,
        metrics: emptyMetrics(),
        items: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
