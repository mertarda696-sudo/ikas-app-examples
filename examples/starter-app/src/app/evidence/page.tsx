'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { CustomerProfileLink } from '@/components/apparel-panel/CustomerProfileLink';
import { TokenHelpers } from '@/helpers/token-helpers';

type EvidenceFilter =
  | 'evidence'
  | 'all'
  | 'previewable'
  | 'stored'
  | 'metadata_only'
  | 'image'
  | 'damaged_product_images'
  | 'damaged_product'
  | 'payment_proof'
  | 'unlinked';

type EvidenceMediaItem = {
  id: string;
  messageId: string | null;
  kind: string | null;
  mimeType: string | null;
  fileName: string | null;
  storagePath: string | null;
  storageBucket?: string | null;
  sizeBytes: number | null;
  whatsappMediaId: string | null;
  mediaSha256: string | null;
  externalMessageId: string | null;
  caption: string | null;
  customerWaId: string | null;
  linkedOrderId: string | null;
  caseNo: string | null;
  caseType: string | null;
  operationCaseId: string | null;
  caseTitle: string | null;
  caseStatus: string | null;
  casePriority: string | null;
  evidenceState: string | null;
  evidenceSummary: string | null;
  conversationId: string | null;
  captureStatus: string | null;
  signedUrl?: string | null;
  signedUrlError?: string | null;
  createdAt: string | null;
};

type EvidenceMediaResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  metrics: {
    total: number;
    stored: number;
    metadataOnly: number;
    images: number;
    linkedCases: number;
    damagedProduct: number;
  };
  items: EvidenceMediaItem[];
  error?: string;
};

const FILTERS: Array<{ key: EvidenceFilter; label: string }> = [
  { key: 'evidence', label: 'Vaka Bağlı Kanıtlar' },
  { key: 'damaged_product_images', label: 'Hasarlı Ürün Fotoğrafları' },
  { key: 'previewable', label: 'Önizlemeli Görseller' },
  { key: 'stored', label: 'Storage’a Alınanlar' },
  { key: 'metadata_only', label: 'Storage Bekleyenler' },
  { key: 'image', label: 'Tüm Fotoğraflar' },
  { key: 'damaged_product', label: 'Hasarlı Ürün Vakaları' },
  { key: 'payment_proof', label: 'Ödeme / Dekont' },
  { key: 'unlinked', label: 'Vakasız / Ürün Sorusu' },
  { key: 'all', label: 'Tüm Medya Kayıtları' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, index);
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function isImageItem(item: EvidenceMediaItem) {
  return String(item.kind || '').toLowerCase() === 'image' || String(item.mimeType || '').toLowerCase().startsWith('image/');
}

function isPreviewableItem(item: EvidenceMediaItem) {
  return Boolean(isImageItem(item) && item.signedUrl);
}

function isCaseLinked(item: EvidenceMediaItem) {
  return Boolean(item.caseNo || item.operationCaseId);
}

function isArchivedEvidence(item: EvidenceMediaItem) {
  return isCaseLinked(item) && (item.caseStatus === 'resolved' || item.caseStatus === 'closed');
}

function isTestEvidenceItem(item: EvidenceMediaItem) {
  const caseNo = String(item.caseNo || '').trim();
  const caseTitle = String(item.caseTitle || '').toLocaleLowerCase('tr-TR');

  return (
    caseNo === 'OP-1777757090913' ||
    caseTitle.includes('qa sipariş') ||
    caseTitle.includes('qa siparis') ||
    caseTitle.startsWith('qa ')
  );
}

function mapCaseTypeLabel(type: string | null | undefined) {
  if (type === 'damaged_product') return 'Hasarlı Ürün';
  if (type === 'shipping_delivery') return 'Kargo / Teslimat';
  if (type === 'payment_proof') return 'Ödeme / Dekont';
  if (type === 'return_exchange') return 'İade / Değişim';
  if (type === 'size_consultation') return 'Beden Danışma';
  if (type === 'order_support') return 'Sipariş Destek';
  if (type === 'hot_lead') return 'Sıcak Lead';
  return type || 'Genel';
}

function mapStatusLabel(status: string | null | undefined) {
  if (status === 'open') return 'Açık';
  if (status === 'in_progress') return 'İnceleniyor';
  if (status === 'waiting_customer') return 'Müşteri Bekleniyor';
  if (status === 'resolved') return 'Çözüldü';
  if (status === 'closed') return 'Kapalı';
  return status || '-';
}

function mapEvidenceStateLabel(state: string | null | undefined) {
  if (state === 'received') return 'Kanıt alındı';
  if (state === 'requested') return 'Kanıt istendi';
  if (state === 'verified') return 'Doğrulandı';
  if (state === 'rejected') return 'Reddedildi';
  if (state === 'missing') return 'Eksik';
  return state || 'Kanıt durumu yok';
}

function mapAttachmentKindLabel(kind: string | null | undefined) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'image') return 'Fotoğraf';
  if (normalized === 'video') return 'Video';
  if (normalized === 'audio') return 'Ses kaydı';
  if (normalized === 'document') return 'Doküman';
  if (normalized === 'sticker') return 'Sticker';
  return kind || 'Medya';
}

function mapCaptureStatusLabel(status: string | null | undefined) {
  if (status === 'stored') return 'Dosya kaydedildi';
  if (status === 'metadata_only') return 'Storage bekliyor';
  if (status === 'downloaded') return 'Dosya indirildi';
  if (status === 'failed') return 'İşleme hatası';
  return status || 'Durum bilinmiyor';
}

function toneForStatus(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'stored' || status === 'verified' || status === 'resolved' || status === 'closed') return 'success';
  if (status === 'metadata_only' || status === 'received' || status === 'open') return 'info';
  if (status === 'requested' || status === 'missing' || status === 'in_progress' || status === 'waiting_customer') return 'warning';
  if (status === 'failed' || status === 'rejected') return 'danger';
  return 'neutral';
}

function Pill({ label, tone }: { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' }) {
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

  return <span style={{ display: 'inline-flex', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 900, ...styles }}>{label}</span>;
}

function MetricCard({ label, value, helper, tone, onClick }: { label: string; value: number; helper: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger'; onClick?: () => void }) {
  const borderColor = tone === 'danger' ? '#fecaca' : tone === 'warning' ? '#fde68a' : tone === 'success' ? '#bbf7d0' : tone === 'info' ? '#bfdbfe' : '#e5e7eb';

  return (
    <button onClick={onClick} style={{ textAlign: 'left', border: `1px solid ${borderColor}`, borderRadius: 18, background: '#ffffff', padding: 18, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#111827' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
    </button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.35 }}>{label}</div>
      <div style={{ color: '#111827', fontSize: 13, lineHeight: 1.55, minWidth: 0, overflowWrap: 'anywhere' }}>{value || '-'}</div>
    </div>
  );
}

function EvidenceMediaCard({ item, onBackfill, backfillState }: { item: EvidenceMediaItem; onBackfill: (item: EvidenceMediaItem) => void; backfillState?: { loading?: boolean; error?: string | null; success?: string | null } }) {
  const hasPreview = isPreviewableItem(item);
  const caseLinked = isCaseLinked(item);
  const archivedEvidence = isArchivedEvidence(item);
  const caseHref = item.caseNo || item.operationCaseId ? `/operations/${item.caseNo || item.operationCaseId}` : null;
  const needsDownloadLater = item.captureStatus === 'metadata_only' && !item.storagePath;

  return (
    <article style={{ border: caseLinked ? '1px solid #fed7aa' : '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 14, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#111827' }}>{mapAttachmentKindLabel(item.kind)}</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }}>{item.mimeType || 'MIME yok'} · {formatDate(item.createdAt)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Pill label={caseLinked ? 'Kanıt medyası' : 'Ürün sorusu / vaka dışı'} tone={caseLinked ? 'warning' : 'neutral'} />
{archivedEvidence ? <Pill label="Arşiv kanıtı" tone="success" /> : null}
<Pill label={mapCaptureStatusLabel(item.captureStatus)} tone={toneForStatus(item.captureStatus)} />
          {hasPreview ? <Pill label="Önizleme var" tone="success" /> : null}
          {item.caseType ? <Pill label={mapCaseTypeLabel(item.caseType)} tone={item.caseType === 'damaged_product' ? 'warning' : 'info'} /> : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 8, border: '1px solid #f3f4f6', background: '#f9fafb', borderRadius: 14, padding: 10 }}>
        <Field label="Vaka türü" value={caseLinked ? mapCaseTypeLabel(item.caseType) : 'Ürün sorusu / vaka dışı'} />
        <Field label="Sipariş" value={item.linkedOrderId || '-'} />
        <Field label="Müşteri" value={item.customerWaId || '-'} />
      </div>

      {hasPreview ? (
        <a href={item.signedUrl || '#'} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
          <img src={item.signedUrl || ''} alt={item.caption || item.id} style={{ width: '100%', height: 260, objectFit: 'contain', borderRadius: 14, border: '1px solid #e5e7eb', background: '#f9fafb' }} />
        </a>
      ) : item.storagePath && item.signedUrl ? (
        <a href={item.signedUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#111827', fontWeight: 900 }}>Dosyayı aç →</a>
      ) : item.storagePath && item.signedUrlError ? (
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800 }}>Önizleme bağlantısı üretilemedi: {item.signedUrlError}</div>
      ) : (
        <div style={{ border: '1px dashed #d1d5db', background: '#f9fafb', color: '#6b7280', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800 }}>Dosya henüz Storage’a alınmadı; metadata kaydı mevcut.</div>
      )}

      {needsDownloadLater ? (
        <div style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800, lineHeight: 1.55, display: 'grid', gap: 10 }}>
          <div>Bu kayıt dosya olarak henüz kaydedilmedi. Gerekirse dosyayı tekrar indirip Storage’a alabilirsiniz.</div>
          <button onClick={() => onBackfill(item)} disabled={Boolean(backfillState?.loading)} style={{ justifySelf: 'start', border: '1px solid #d97706', background: backfillState?.loading ? '#f3f4f6' : '#ffffff', color: backfillState?.loading ? '#6b7280' : '#92400e', borderRadius: 999, padding: '9px 13px', fontSize: 13, fontWeight: 900, cursor: backfillState?.loading ? 'not-allowed' : 'pointer' }}>
            {backfillState?.loading ? 'Yeniden indiriliyor...' : 'Yeniden İndir ve Storage’a Al'}
          </button>
          {backfillState?.error ? <div style={{ color: '#991b1b' }}>{backfillState.error}</div> : null}
          {backfillState?.success ? <div style={{ color: '#166534' }}>{backfillState.success}</div> : null}
        </div>
      ) : null}

      {item.caption ? <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', color: '#1e3a8a', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800, lineHeight: 1.55 }}>{item.caption}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <Field label="Vaka" value={item.caseNo || '-'} />
        <Field label="Vaka Başlığı" value={item.caseTitle || '-'} />
        <Field label="Vaka Durumu" value={mapStatusLabel(item.caseStatus)} />
        <Field label="Kanıt Durumu" value={mapEvidenceStateLabel(item.evidenceState)} />
        <Field label="Dosya kayıt yeri" value={item.storageBucket || '-'} />
        <Field label="Dosya yolu" value={item.storagePath || 'metadata_only / dosya henüz indirilmedi'} />
        <Field label="WhatsApp Media ID" value={item.whatsappMediaId || '-'} />
        <Field label="Message ID" value={item.messageId || '-'} />
        <Field label="Dosya Boyutu" value={formatBytes(item.sizeBytes)} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
        {caseHref ? <Link href={caseHref} style={{ color: '#2563eb', fontWeight: 900, textDecoration: 'none' }}>Vaka Detayına Git →</Link> : null}
        {item.conversationId ? <Link href={`/inbox/${item.conversationId}`} style={{ color: '#111827', fontWeight: 900, textDecoration: 'none' }}>Konuşmaya Git →</Link> : null}
        {item.linkedOrderId ? <Link href={`/orders/${item.linkedOrderId}`} style={{ color: '#111827', fontWeight: 900, textDecoration: 'none' }}>Siparişe Git →</Link> : null}
        <CustomerProfileLink customerWaId={item.customerWaId} compact />
      </div>
    </article>
  );
}

export default function EvidencePage() {
  const [data, setData] = useState<EvidenceMediaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<EvidenceFilter>('evidence');
  const [query, setQuery] = useState('');
  const [backfillById, setBackfillById] = useState<Record<string, { loading?: boolean; error?: string | null; success?: string | null }>>({});

  const loadEvidence = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      const iframeToken = await TokenHelpers.getTokenForIframeApp();
      if (!iframeToken) {
        setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, metrics: { total: 0, stored: 0, metadataOnly: 0, images: 0, linkedCases: 0, damagedProduct: 0 }, items: [], error: 'iFrame JWT token alınamadı.' });
        return;
      }
      const response = await fetch('/api/apparel/evidence-media', { cache: 'no-store', headers: { Authorization: 'JWT ' + iframeToken } });
      setData((await response.json()) as EvidenceMediaResponse);
    } catch (error) {
      setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, metrics: { total: 0, stored: 0, metadataOnly: 0, images: 0, linkedCases: 0, damagedProduct: 0 }, items: [], error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  const items = data?.items || [];
  const localMetrics = useMemo(() => {
    const realEvidence = items.filter((item) => isCaseLinked(item) && !isTestEvidenceItem(item)).length;
    const previewable = items.filter(isPreviewableItem).length;
    const damagedProductImages = items.filter((item) => item.caseType === 'damaged_product' && isImageItem(item)).length;
    const unlinked = items.filter((item) => !isCaseLinked(item)).length;
    return { realEvidence, previewable, damagedProductImages, unlinked };
  }, [items]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter =
  activeFilter === 'evidence'
    ? isCaseLinked(item) && !isTestEvidenceItem(item)
          : activeFilter === 'all'
            ? true
            : activeFilter === 'previewable'
              ? isPreviewableItem(item)
              : activeFilter === 'stored'
                ? item.captureStatus === 'stored'
                : activeFilter === 'metadata_only'
                  ? item.captureStatus === 'metadata_only'
                  : activeFilter === 'image'
                    ? isImageItem(item)
                    : activeFilter === 'damaged_product_images'
                      ? item.caseType === 'damaged_product' && isImageItem(item)
                      : activeFilter === 'unlinked'
                        ? !isCaseLinked(item)
                        : item.caseType === activeFilter;
      if (!matchesFilter) return false;
      if (!needle) return true;
      const haystack = [item.caption, item.caseNo, item.caseType, item.caseTitle, item.customerWaId, item.linkedOrderId, item.whatsappMediaId, item.messageId, item.externalMessageId].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [activeFilter, items, query]);

  const handleBackfill = async (item: EvidenceMediaItem) => {
    try {
      setBackfillById((current) => ({ ...current, [item.id]: { loading: true, error: null, success: null } }));
      const iframeToken = await TokenHelpers.getTokenForIframeApp();
      if (!iframeToken) throw new Error('iFrame JWT token alınamadı.');

      const response = await fetch('/api/apparel/evidence-media/backfill', {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: 'JWT ' + iframeToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachmentId: item.id }),
      });
      const raw = await response.json();
      if (!response.ok || !raw?.ok) throw new Error(raw?.error || 'Yeniden indirme başarısız oldu.');

      setBackfillById((current) => ({ ...current, [item.id]: { loading: false, error: null, success: raw?.status === 'skipped' ? 'Kayıt zaten Storage’da.' : 'Dosya Storage’a alındı.' } }));
      await loadEvidence({ silent: true });
    } catch (error) {
      setBackfillById((current) => ({ ...current, [item.id]: { loading: false, error: error instanceof Error ? error.message : 'Yeniden indirme sırasında hata oluştu.', success: null } }));
    }
  };

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>Kanıt ve Medya Operasyonu</div>
            <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 8px', color: '#111827' }}>Kanıt / Medya Merkezi</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7, maxWidth: 880 }}>
              Varsayılan görünüm sadece operasyon vakasına bağlı gerçek kanıtları gösterir. “Bu ürün var mı?” gibi ürün sorusu görselleri silinmez; ayrı Vakasız Medya filtresinde tutulur.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/operations" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#111827', color: '#ffffff', fontWeight: 800 }}>Operasyonlar →</Link>
            <Link href="/operator-actions" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 800 }}>Aksiyon Merkezi →</Link>
          </div>
        </div>

        {loading ? <div>Yükleniyor...</div> : data?.error ? <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 800 }}>{data.error}</div> : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <MetricCard label="Vaka Bağlı Kanıt" value={localMetrics.realEvidence} helper="Operasyon vakasına bağlanmış medya" tone="success" onClick={() => setActiveFilter('evidence')} />
              <MetricCard label="Hasarlı Ürün Fotoğrafı" value={localMetrics.damagedProductImages} helper="Öncelikli operasyon kanıtları" tone={localMetrics.damagedProductImages > 0 ? 'warning' : 'neutral'} onClick={() => setActiveFilter('damaged_product_images')} />
              <MetricCard label="Önizlemeli Görsel" value={localMetrics.previewable} helper="Panelde doğrudan görülebilen dosyalar" tone={localMetrics.previewable > 0 ? 'success' : 'neutral'} onClick={() => setActiveFilter('previewable')} />
              <MetricCard label="Storage Bekleyen" value={data?.metrics.metadataOnly || 0} helper={(data?.metrics.metadataOnly || 0) > 0 ? 'Yeniden indir aksiyonu adayları' : 'Temiz: Storage bekleyen kayıt yok'} tone={(data?.metrics.metadataOnly || 0) > 0 ? 'warning' : 'success'} onClick={() => setActiveFilter('metadata_only')} />
              <MetricCard label="Vakasız / Ürün Sorusu" value={localMetrics.unlinked} helper="Vaka dışı ürün sorusu veya genel görseller" tone={localMetrics.unlinked > 0 ? 'info' : 'neutral'} onClick={() => setActiveFilter('unlinked')} />
              <MetricCard label="Toplam Medya" value={data?.metrics.total || 0} helper="Tüm attachment kayıtları" tone="info" onClick={() => setActiveFilter('all')} />
            </section>

            {(data?.metrics.metadataOnly || 0) === 0 ? (
  <section style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 18, padding: 14, color: '#166534', fontSize: 13, fontWeight: 800, lineHeight: 1.65 }}>
    Storage bekleyen medya kalmadı. Uygun kayıtlar dosya/önizleme seviyesine alınmış görünüyor.
  </section>
) : null}

            <section style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 18, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#9a3412', fontSize: 17, fontWeight: 900 }}>Varsayılan ekran: vaka bağlı kanıtlar</div>
                <div style={{ color: '#7c2d12', fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
                  Bu ekran operasyon vakasına bağlı fotoğraf, dekont, iade veya hasarlı ürün medyalarını gösterir. Vakasız ürün görselleri ayrı filtrede durur.
                </div>
              </div>
              <button onClick={() => setActiveFilter('damaged_product_images')} style={{ border: '1px solid #ea580c', background: activeFilter === 'damaged_product_images' ? '#ea580c' : '#ffffff', color: activeFilter === 'damaged_product_images' ? '#ffffff' : '#9a3412', borderRadius: 999, padding: '11px 16px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>Hasarlı Ürün Fotoğraflarını Göster →</button>
            </section>

            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>Medya Kayıtları</div>
                  <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                    Aktif filtre: {FILTERS.find((filter) => filter.key === activeFilter)?.label || 'Filtre'}
                  </div>
                </div>
                <Pill label={`${rows.length} kayıt`} tone="neutral" />
              </div>

              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Case no, sipariş no, müşteri, caption veya WhatsApp media ID ara..." style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 14, padding: '12px 14px', marginBottom: 14, fontSize: 14 }} />

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {FILTERS.map((filter) => {
                  const active = activeFilter === filter.key;
                  return <button key={filter.key} onClick={() => setActiveFilter(filter.key)} style={{ border: active ? '1px solid #111827' : '1px solid #d1d5db', background: active ? '#111827' : '#ffffff', color: active ? '#ffffff' : '#111827', borderRadius: 999, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{filter.label}</button>;
                })}
              </div>

              {rows.length === 0 ? (
  <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 18, color: '#6b7280', background: '#f9fafb', lineHeight: 1.7 }}>
    {activeFilter === 'metadata_only' && (data?.metrics.metadataOnly || 0) === 0
      ? 'Storage bekleyen medya kalmadı. Tüm uygun kayıtlar dosya/önizleme seviyesine alınmış görünüyor.'
      : 'Seçili filtre için medya kaydı bulunmuyor.'}
  </div>
) : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>{rows.map((item) => <EvidenceMediaCard key={item.id} item={item} onBackfill={handleBackfill} backfillState={backfillById[item.id]} />)}</div>}
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
