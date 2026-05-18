'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';

type LinkFilter =
  | 'all'
  | 'product'
  | 'social'
  | 'tracking'
  | 'unknown'
  | 'review'
  | 'unsafe'
  | 'shortened'
  | 'tenant_domain';

type LinkAnalysisItem = {
  id: string;
  analysisType: string | null;
  analysisStatus: string | null;
  analysisStatusLabel: string;
  linkType: string | null;
  linkTypeLabel: string;
  detectedIntent: string | null;
  detectedCustomerIntent: string | null;
  summaryText: string | null;
  confidence: number | null;
  needsOperatorReview: boolean;
  safetyStatus: string | null;
  safetyStatusLabel: string;
  safetyReason: string | null;
  modelProvider: string | null;
  modelName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ProductMatchItem = {
  id: string;
  analysisStatus: string | null;
  analysisStatusLabel: string;
  detectedIntent: string | null;
  detectedCustomerIntent: string | null;
  summaryText: string | null;
  confidence: number | null;
  needsOperatorReview: boolean;
  matchedProductId: string | null;
  matchedProductName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type OperatorReviewItem = {
  kind: string;
  label: string;
  note: string;
};

type MessageLinkItem = {
  id: string;
  messageId: string | null;
  conversationId: string | null;
  channel: string | null;
  direction: string | null;
  customerWaId: string | null;
  originalText: string | null;
  messageText: string | null;
  originalUrl: string | null;
  normalizedUrl: string | null;
  urlScheme: string | null;
  urlHost: string | null;
  urlPath: string | null;
  urlQueryPresent: boolean;
  linkIndex: number | null;
  linkSource: string | null;
  linkType: string | null;
  linkTypeLabel: string;
  captureStatus: string | null;
  captureStatusLabel: string;
  classificationStatus: string | null;
  classificationStatusLabel: string;
  detectedIntent: string | null;
  detectedCustomerIntent: string | null;
  isShortenedUrl: boolean;
  isTenantDomain: boolean;
  isKnownCommerceDomain: boolean;
  isPotentiallyUnsafe: boolean;
  safetyStatus: string | null;
  safetyStatusLabel: string;
  safetyReason: string | null;
  riskLevel: string;
  matchedProductId: string | null;
  matchedProductName: string | null;
  linkedOrderId: string | null;
  operationCaseId: string | null;
  caseNo: string | null;
  reviewStatus: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  operatorReview: OperatorReviewItem | null;
  createdAt: string | null;
  updatedAt: string | null;
  messageCreatedAt: string | null;
  analysis: LinkAnalysisItem | null;
  productMatch: ProductMatchItem | null;
};

type MessageLinksResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  metrics: {
    total: number;
    captured: number;
    safetyReview: number;
    unsafe: number;
    shortened: number;
    productLinks: number;
    socialLinks: number;
    trackingLinks: number;
    unknownLinks: number;
  };
  items: MessageLinkItem[];
  error?: string;
};

const EMPTY_RESPONSE: MessageLinksResponse = {
  ok: false,
  fetchedAt: new Date().toISOString(),
  tenant: null,
  metrics: {
    total: 0,
    captured: 0,
    safetyReview: 0,
    unsafe: 0,
    shortened: 0,
    productLinks: 0,
    socialLinks: 0,
    trackingLinks: 0,
    unknownLinks: 0,
  },
  items: [],
};

const FILTERS: Array<{ key: LinkFilter; label: string; helper: string }> = [
  { key: 'all', label: 'Tüm Linkler', helper: 'Son yakalanan müşteri linkleri.' },
  { key: 'product', label: 'Ürün Linkleri', helper: 'Mağaza veya ürün sayfası linkleri.' },
  { key: 'tracking', label: 'Kargo / Takip', helper: 'Takip ve teslimat bağlantıları.' },
  { key: 'social', label: 'Sosyal Medya', helper: 'Instagram ve benzeri sosyal medya linkleri.' },
  { key: 'review', label: 'İnceleme Kuyruğu', helper: 'Operatörün kontrol etmesi gereken linkler.' },
  { key: 'unsafe', label: 'Güvensiz', helper: 'Localhost/private/unsafe olarak işaretlenenler.' },
  { key: 'shortened', label: 'Kısaltılmış', helper: 'bit.ly gibi açılmadan bekletilen linkler.' },
  { key: 'tenant_domain', label: 'Tenant Domain', helper: 'Markanın kendi domaini olarak yakalananlar.' },
  { key: 'unknown', label: 'Genel Link', helper: 'Henüz sınıflandırılmamış genel linkler.' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function formatConfidence(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

function truncateMiddle(value: string | null | undefined, max = 86) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= max) return text;

  const head = Math.max(20, Math.floor(max * 0.55));
  const tail = Math.max(14, max - head - 3);

  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function toneForLinkType(type: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (type === 'product_link') return 'success';
  if (type === 'tracking_link') return 'info';
  if (type === 'social_media_link') return 'info';
  if (type === 'unsafe_link') return 'danger';
  if (type === 'unknown_link') return 'neutral';
  return 'neutral';
}

function toneForCaptureStatus(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'captured') return 'success';
  if (status === 'safety_review') return 'warning';
  if (status === 'invalid_url' || status === 'failed') return 'danger';
  return 'neutral';
}

function toneForSafetyStatus(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'safe') return 'success';
  if (status === 'review') return 'warning';
  if (status === 'unsafe') return 'danger';
  if (status === 'unchecked') return 'neutral';
  return 'neutral';
}

function toneForAnalysisStatus(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'completed') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'skipped') return 'neutral';
  return 'neutral';
}

function toneForOperatorReviewKind(kind: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (kind === 'security_review') return 'danger';
  if (kind === 'manual_product_check') return 'warning';
  if (kind === 'social_media_check') return 'info';
  if (kind === 'unknown_link_review') return 'warning';
  return 'warning';
}

function canOpenExternalLink(item: MessageLinkItem) {
  if (!item.normalizedUrl) return false;

  if (item.riskLevel === 'unsafe') return false;
  if (item.riskLevel === 'review') return false;

  if (item.captureStatus === 'safety_review') return false;
  if (item.safetyStatus === 'unsafe') return false;
  if (item.safetyStatus === 'review') return false;
  if (item.linkType === 'unknown_link' && item.analysis?.needsOperatorReview) return false;

  if (item.isShortenedUrl) return false;
  if (item.isPotentiallyUnsafe) return false;

  const host = String(item.urlHost || '').toLowerCase();

  if (host === 'localhost') return false;
  if (host === '127.0.0.1') return false;
  if (host.startsWith('10.')) return false;
  if (host.startsWith('192.168.')) return false;

  return true;
}

function getProductMatchView(item: MessageLinkItem) {
  if (item.linkType !== 'product_link') return null;

  const matchedProductName = item.matchedProductName || item.productMatch?.matchedProductName || null;

  if (matchedProductName) {
    return {
      tone: 'success' as const,
      title: 'Ürün eşleşti',
      result: matchedProductName,
      manualCheck: 'Hayır',
      note: 'Bu müşteri linki katalogdaki ürünle eşleşti.',
    };
  }

  if (!item.productMatch) {
    return {
      tone: 'warning' as const,
      title: 'Ürün eşleşmesi bekliyor',
      result: 'Henüz otomatik eşleştirme sonucu yok.',
      manualCheck: 'Gerekebilir',
      note: 'Bu link için ürün eşleştirme işlemi henüz çalışmamış olabilir.',
    };
  }

  if (item.productMatch.detectedIntent === 'product_match_no_handle') {
    return {
      tone: 'warning' as const,
      title: 'Ürün eşleşmedi',
      result: 'Linkten geçerli ürün bilgisi çıkarılamadı.',
      manualCheck: 'Gerekebilir',
      note: 'Bu link mağaza ana sayfası, eksik ürün yolu veya test linki olabilir.',
    };
  }

  if (item.productMatch.detectedIntent === 'product_match_not_found') {
    return {
      tone: 'warning' as const,
      title: 'Ürün eşleşmedi',
      result: 'Bu link katalogdaki bir ürünle otomatik eşleşmedi.',
      manualCheck: 'Gerekebilir',
      note: 'Ürün katalogda yok, silinmiş veya link yapısı değişmiş olabilir.',
    };
  }

  if (item.productMatch.detectedIntent === 'product_match_ambiguous') {
    return {
      tone: 'warning' as const,
      title: 'Manuel kontrol gerekebilir',
      result: 'Birden fazla ürün adayı bulundu.',
      manualCheck: 'Evet',
      note: 'Doğru ürünün operatör tarafından seçilmesi gerekir.',
    };
  }

  return {
    tone: item.productMatch.needsOperatorReview ? 'warning' as const : 'neutral' as const,
    title: item.productMatch.needsOperatorReview ? 'Manuel kontrol gerekebilir' : 'Ürün eşleşmesi kontrol edildi',
    result: item.productMatch.summaryText || 'Ürün eşleşme sonucu kaydedildi.',
    manualCheck: item.productMatch.needsOperatorReview ? 'Evet' : 'Hayır',
    note: 'Ürün eşleşme sonucu otomatik olarak değerlendirildi.',
  };
}

function matchesFilter(item: MessageLinkItem, filter: LinkFilter) {
  if (filter === 'all') return true;
  if (filter === 'product') return item.linkType === 'product_link';
  if (filter === 'social') return item.linkType === 'social_media_link';
  if (filter === 'tracking') return item.linkType === 'tracking_link';
  if (filter === 'unknown') return item.linkType === 'unknown_link';
  if (filter === 'review') {
  return Boolean(item.operatorReview) || item.captureStatus === 'safety_review' || item.safetyStatus === 'review' || item.riskLevel === 'review';
}
  if (filter === 'unsafe') return item.linkType === 'unsafe_link' || item.safetyStatus === 'unsafe' || item.isPotentiallyUnsafe;
  if (filter === 'shortened') return item.isShortenedUrl;
  if (filter === 'tenant_domain') return item.isTenantDomain;
  return true;
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger';
}) {
  const styles =
    tone === 'success'
      ? { background: '#ecfdf5', color: '#065f46' }
      : tone === 'warning'
        ? { background: '#fffbeb', color: '#92400e' }
        : tone === 'info'
          ? { background: '#eff6ff', color: '#1d4ed8' }
          : tone === 'danger'
            ? { background: '#fef2f2', color: '#991b1b' }
            : { background: '#f3f4f6', color: '#374151' };

  return (
    <span
      style={{
        display: 'inline-flex',
        borderRadius: 999,
        padding: '5px 10px',
        fontSize: 12,
        fontWeight: 900,
        ...styles,
      }}
    >
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  helper: string;
  tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger';
  onClick?: () => void;
}) {
  const borderColor =
    tone === 'danger'
      ? '#fecaca'
      : tone === 'warning'
        ? '#fde68a'
        : tone === 'success'
          ? '#bbf7d0'
          : tone === 'info'
            ? '#bfdbfe'
            : '#e5e7eb';

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: `1px solid ${borderColor}`,
        borderRadius: 18,
        background: '#ffffff',
        padding: 18,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#111827' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
    </button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          color: '#6b7280',
          fontSize: 11,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: 0.35,
        }}
      >
        {label}
      </div>
      <div style={{ color: '#111827', fontSize: 13, lineHeight: 1.55, minWidth: 0, overflowWrap: 'anywhere' }}>
        {value === null || value === undefined || value === '' ? '-' : value}
      </div>
    </div>
  );
}

function LinkCard({ item }: { item: MessageLinkItem }) {
  const externalAllowed = canOpenExternalLink(item);
  const productMatchView = getProductMatchView(item);

  return (
    <article
      style={{
        border: item.riskLevel === 'unsafe' ? '1px solid #fecaca' : '1px solid #e5e7eb',
        borderRadius: 18,
        background: '#ffffff',
        padding: 18,
        display: 'grid',
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 14,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <Pill label={item.linkTypeLabel} tone={toneForLinkType(item.linkType)} />
            <Pill label={item.captureStatusLabel} tone={toneForCaptureStatus(item.captureStatus)} />
            <Pill label={item.safetyStatusLabel} tone={toneForSafetyStatus(item.safetyStatus)} />
                        {item.analysis ? (
              <Pill label={item.analysis.analysisStatusLabel} tone={toneForAnalysisStatus(item.analysis.analysisStatus)} />
            ) : (
              <Pill label="Analiz yok" tone="neutral" />
            )}
            {item.operatorReview ? (
  <Pill label={item.operatorReview.label} tone={toneForOperatorReviewKind(item.operatorReview.kind)} />
) : null}
            {item.isShortenedUrl ? <Pill label="Kısaltılmış link" tone="warning" /> : null}
            {item.isTenantDomain ? <Pill label="Tenant domain" tone="success" /> : null}
            {item.isKnownCommerceDomain ? <Pill label="Ticaret domaini" tone="info" /> : null}
          </div>

          <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
            {item.urlHost || 'Bilinmeyen host'}
            <span style={{ color: '#6b7280', fontWeight: 700 }}>{item.urlPath || ''}</span>
          </div>

          <div style={{ marginTop: 8, color: '#4b5563', fontSize: 13, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
            {truncateMiddle(item.normalizedUrl || item.originalUrl, 112)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {item.conversationId ? (
            <Link
              href={`/inbox/${item.conversationId}`}
              style={{
                textDecoration: 'none',
                border: '1px solid #111827',
                background: '#111827',
                color: '#ffffff',
                borderRadius: 12,
                padding: '9px 12px',
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              Konuşmaya Git
            </Link>
          ) : null}

          {externalAllowed ? (
            <a
              href={item.normalizedUrl || item.originalUrl || '#'}
              target="_blank"
              rel="noreferrer"
              style={{
                textDecoration: 'none',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#111827',
                borderRadius: 12,
                padding: '9px 12px',
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              Linki Aç
            </a>
          ) : (
            <span
              style={{
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#991b1b',
                borderRadius: 12,
                padding: '9px 12px',
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              Dış link kapalı
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          borderTop: '1px solid #f3f4f6',
          paddingTop: 14,
        }}
      >
        <Field label="Müşteri" value={item.customerWaId || '-'} />
        <Field label="Kanal" value={item.channel || '-'} />
        <Field label="Mesaj Tarihi" value={formatDate(item.messageCreatedAt || item.createdAt)} />
        <Field label="Link Index" value={item.linkIndex ?? '-'} />
        <Field label="Sınıflandırma" value={item.classificationStatusLabel} />
        <Field label="Güvenlik Nedeni" value={item.safetyReason || '-'} />
      </div>

      <div
        style={{
          border: '1px solid #f3f4f6',
          borderRadius: 14,
          background: '#f9fafb',
          padding: 12,
          display: 'grid',
          gap: 8,
        }}
      >
        <Field label="Müşteri Mesajı" value={item.messageText || item.originalText || '-'} />
        <Field label="Orijinal URL" value={item.originalUrl || '-'} />
      </div>

      {item.operatorReview && !productMatchView ? (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
      border: '1px solid #fde68a',
      borderRadius: 14,
      background: '#fffbeb',
      padding: 12,
    }}
  >
    <Field label="İnceleme Durumu" value={item.operatorReview.label} />
    <Field label="Not" value={item.operatorReview.note} />
    <Field label="İşlem Durumu" value={item.reviewStatus || 'open'} />
  </div>
) : null}

            {productMatchView ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            border: productMatchView.tone === 'success' ? '1px solid #bbf7d0' : '1px solid #fde68a',
            borderRadius: 14,
            background: productMatchView.tone === 'success' ? '#f0fdf4' : '#fffbeb',
            padding: 12,
          }}
        >
          <Field label="Ürün Durumu" value={productMatchView.title} />
          <Field label="Sonuç" value={productMatchView.result} />
          <Field label="Manuel Kontrol" value={productMatchView.manualCheck} />
          <Field label="Not" value={productMatchView.note} />
          {item.linkedOrderId ? <Field label="Bağlı Sipariş" value={item.linkedOrderId} /> : null}
          {item.caseNo ? <Field label="Bağlı Vaka" value={item.caseNo} /> : null}
        </div>
      ) : null}
    </article>
  );
}

export default function LinksPage() {
  const [data, setData] = useState<MessageLinksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<LinkFilter>('all');

  useEffect(() => {
    const run = async () => {
      try {
        const token = await TokenHelpers.getTokenForIframeApp();

        if (!token) {
          setData({
            ...EMPTY_RESPONSE,
            fetchedAt: new Date().toISOString(),
            error: 'iFrame JWT token alınamadı.',
          });
          return;
        }

        const response = await fetch('/api/apparel/message-links', {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + token },
        });

        const json = (await response.json()) as MessageLinksResponse;
        setData(json);
      } catch (error) {
        setData({
          ...EMPTY_RESPONSE,
          fetchedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const items = data?.items || [];
  const metrics = data?.metrics || EMPTY_RESPONSE.metrics;
    const reviewQueueSummary = useMemo(() => {
    const reviewItems = items.filter((item) => Boolean(item.operatorReview));

    return {
      total: reviewItems.length,
      security: reviewItems.filter((item) => item.operatorReview?.kind === 'security_review').length,
      product: reviewItems.filter((item) => item.operatorReview?.kind === 'manual_product_check').length,
      social: reviewItems.filter((item) => item.operatorReview?.kind === 'social_media_check').length,
      unknown: reviewItems.filter((item) => item.operatorReview?.kind === 'unknown_link_review').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => matchesFilter(item, activeFilter));
  }, [activeFilter, items]);

  return (
    <AppShell>
      <main
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: 24,
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>Müşteri Linkleri</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              WhatsApp konuşmalarından yakalanan ürün, sosyal medya, kargo ve güvenlik incelemesi gereken linkleri izleyin.
            </p>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              background: '#ffffff',
              padding: '10px 12px',
              color: '#6b7280',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: '#111827' }}>Son güncelleme:</strong>
            <br />
            {formatDate(data?.fetchedAt)}
          </div>
        </div>

        {loading ? (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
            Link kayıtları yükleniyor...
          </div>
        ) : null}

        {!loading && data?.error ? (
          <div
            style={{
              border: '1px solid #fecaca',
              borderRadius: 18,
              background: '#fef2f2',
              padding: 18,
              color: '#991b1b',
              marginBottom: 18,
              lineHeight: 1.6,
            }}
          >
            <strong>Link kayıtları alınamadı.</strong>
            <br />
            {data.error}
          </div>
        ) : null}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <MetricCard label="Toplam Link" value={metrics.total} helper="Tenant için yakalanan toplam link sayısı." tone="neutral" onClick={() => setActiveFilter('all')} />
          <MetricCard label="Yakalanan" value={metrics.captured} helper="Normal şekilde yakalanan linkler." tone="success" onClick={() => setActiveFilter('all')} />
          <MetricCard label="Güvenlik İncelemesi" value={metrics.safetyReview} helper="Kısa link veya güvenlik nedeniyle bekletilenler." tone="warning" onClick={() => setActiveFilter('review')} />
          <MetricCard label="Güvensiz" value={metrics.unsafe} helper="Localhost/private/unsafe olarak işaretlenenler." tone="danger" onClick={() => setActiveFilter('unsafe')} />
          <MetricCard label="Kısaltılmış" value={metrics.shortened} helper="bit.ly gibi açılmadan bekletilen linkler." tone="warning" onClick={() => setActiveFilter('shortened')} />
        </section>

        <section
  style={{
    border: '1px solid #fde68a',
    borderRadius: 18,
    background: '#fffbeb',
    padding: 16,
    marginBottom: 18,
  }}
>
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      marginBottom: 12,
    }}
  >
    <div>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>
        İnceleme Kuyruğu
      </div>
      <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
        Operatörün kontrol etmesi gerekebilecek linkler burada özetlenir.
      </div>
    </div>

    <button
      type="button"
      onClick={() => setActiveFilter('review')}
      style={{
        border: '1px solid #92400e',
        background: activeFilter === 'review' ? '#92400e' : '#ffffff',
        color: activeFilter === 'review' ? '#ffffff' : '#92400e',
        borderRadius: 999,
        padding: '9px 12px',
        fontSize: 13,
        fontWeight: 900,
        cursor: 'pointer',
      }}
    >
      Kuyruğu Gör
    </button>
  </div>

  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: 10,
    }}
  >
    <MetricCard
      label="Toplam"
      value={reviewQueueSummary.total}
      helper="Kontrol bekleyen toplam link."
      tone="warning"
      onClick={() => setActiveFilter('review')}
    />

    <MetricCard
      label="Güvenlik"
      value={reviewQueueSummary.security}
      helper="Şüpheli, kısaltılmış veya güvenli olmayan linkler."
      tone="danger"
      onClick={() => setActiveFilter('review')}
    />

    <MetricCard
      label="Ürün Kontrolü"
      value={reviewQueueSummary.product}
      helper="Ürünle otomatik eşleşmeyen ürün linkleri."
      tone="warning"
      onClick={() => setActiveFilter('review')}
    />

    <MetricCard
      label="Sosyal Medya"
      value={reviewQueueSummary.social}
      helper="Sosyal medya içeriği kontrol gerektiren linkler."
      tone="info"
      onClick={() => setActiveFilter('review')}
    />

    <MetricCard
      label="Genel Link"
      value={reviewQueueSummary.unknown}
      helper="Otomatik sınıfa güvenle alınmayan genel linkler."
      tone="neutral"
      onClick={() => setActiveFilter('review')}
    />
  </div>
</section>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#ffffff',
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: '#111827', marginBottom: 12 }}>Filtreler</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FILTERS.map((filter) => {
              const active = activeFilter === filter.key;

              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  title={filter.helper}
                  style={{
                    border: active ? '1px solid #111827' : '1px solid #e5e7eb',
                    background: active ? '#111827' : '#ffffff',
                    color: active ? '#ffffff' : '#111827',
                    borderRadius: 999,
                    padding: '9px 12px',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12, color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
            Gösterilen kayıt: <strong style={{ color: '#111827' }}>{filteredItems.length}</strong> / {items.length}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 14 }}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => <LinkCard key={item.id} item={item} />)
          ) : (
            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                background: '#ffffff',
                padding: 18,
                color: '#6b7280',
                lineHeight: 1.7,
              }}
            >
              Bu filtreye uygun link kaydı bulunamadı.
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
