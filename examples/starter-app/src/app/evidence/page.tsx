'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { CustomerProfileLink } from '@/components/apparel-panel/CustomerProfileLink';
import { TokenHelpers } from '@/helpers/token-helpers';

type EvidenceFilter = 'all' | 'stored' | 'metadata_only' | 'image' | 'damaged_product' | 'payment_proof' | 'unlinked';

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
  { key: 'all', label: 'Tüm Medyalar' },
  { key: 'stored', label: 'Storage’a Yüklenenler' },
  { key: 'metadata_only', label: 'Sadece Metadata' },
  { key: 'image', label: 'Fotoğraflar' },
  { key: 'damaged_product', label: 'Hasarlı Ürün' },
  { key: 'payment_proof', label: 'Ödeme / Dekont' },
  { key: 'unlinked', label: 'Vakasız Medya' },
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
  if (status === 'stored') return 'Storage’a yüklendi';
  if (status === 'metadata_only') return 'Metadata kaydedildi';
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

function MetricCard({ label, value, helper, tone }: { label: string; value: number; helper: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' }) {
  const borderColor = tone === 'danger' ? '#fecaca' : tone === 'warning' ? '#fde68a' : tone === 'success' ? '#bbf7d0' : tone === 'info' ? '#bfdbfe' : '#e5e7eb';
  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#111827' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
    </div>
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

function EvidenceMediaCard({ item }: { item: EvidenceMediaItem }) {
  const isImage = String(item.kind || '').toLowerCase() === 'image' || String(item.mimeType || '').toLowerCase().startsWith('image/');
  const hasPreview = Boolean(isImage && item.signedUrl);
  const caseHref = item.caseNo || item.operationCaseId ? `/operations/${item.caseNo || item.operationCaseId}` : null;

  return (
    <article style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 14, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#111827' }}>{mapAttachmentKindLabel(item.kind)}</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }}>{item.mimeType || 'MIME yok'} · {formatDate(item.createdAt)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Pill label={mapCaptureStatusLabel(item.captureStatus)} tone={toneForStatus(item.captureStatus)} />
          {item.caseType ? <Pill label={mapCaseTypeLabel(item.caseType)} tone="warning" /> : <Pill label="Vakasız" tone="neutral" />}
        </div>
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

      {item.caption ? <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', color: '#1e3a8a', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800, lineHeight: 1.55 }}>{item.caption}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <Field label="Vaka" value={item.caseNo || '-'} />
        <Field label="Vaka Başlığı" value={item.caseTitle || '-'} />
        <Field label="Vaka Durumu" value={mapStatusLabel(item.caseStatus)} />
        <Field label="Kanıt Durumu" value={mapEvidenceStateLabel(item.evidenceState)} />
        <Field label="Müşteri" value={item.customerWaId || '-'} />
        <Field label="Sipariş" value={item.linkedOrderId || '-'} />
        <Field label="Storage bucket" value={item.storageBucket || '-'} />
        <Field label="Storage path" value={item.storagePath || 'metadata_only / dosya henüz indirilmedi'} />
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
  const [activeFilter, setActiveFilter] = useState<EvidenceFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
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
        setLoading(false);
      }
    };
    run();
  }, []);

  const items = data?.items || [];
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter =
        activeFilter === 'all'
          ? true
          : activeFilter === 'stored'
            ? item.captureStatus === 'stored'
            : activeFilter === 'metadata_only'
              ? item.captureStatus === 'metadata_only'
              : activeFilter === 'image'
                ? String(item.kind || '').toLowerCase() === 'image' || String(item.mimeType || '').toLowerCase().startsWith('image/')
                : activeFilter === 'unlinked'
                  ? !item.caseNo && !item.operationCaseId
                  : item.caseType === activeFilter;
      if (!matchesFilter) return false;
      if (!needle) return true;
      const haystack = [item.caption, item.caseNo, item.caseType, item.caseTitle, item.customerWaId, item.linkedOrderId, item.whatsappMediaId, item.messageId, item.externalMessageId].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [activeFilter, items, query]);

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>Kanıt ve Medya Operasyonu</div>
            <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 8px', color: '#111827' }}>Kanıt / Medya Merkezi</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7, maxWidth: 850 }}>WhatsApp’tan gelen hasarlı ürün fotoğrafları, dekontlar, dokümanlar ve diğer kanıt medyalarını tek merkezde görüntüleyin. Storage’a alınan dosyalar geçici imzalı bağlantıyla önizlenir.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/operations" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#111827', color: '#ffffff', fontWeight: 800 }}>Operasyonlar →</Link>
            <Link href="/operator-actions" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 800 }}>Aksiyon Merkezi →</Link>
          </div>
        </div>

        {loading ? <div>Yükleniyor...</div> : data?.error ? <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 800 }}>{data.error}</div> : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <MetricCard label="Toplam Medya" value={data?.metrics.total || 0} helper="attachments tablosundaki tüm kayıtlar" tone="info" />
              <MetricCard label="Storage’da" value={data?.metrics.stored || 0} helper="Dosyası indirilip bucket’a yüklenenler" tone={(data?.metrics.stored || 0) > 0 ? 'success' : 'neutral'} />
              <MetricCard label="Metadata Only" value={data?.metrics.metadataOnly || 0} helper="Dosyası henüz indirilmemiş kayıtlar" tone={(data?.metrics.metadataOnly || 0) > 0 ? 'warning' : 'success'} />
              <MetricCard label="Fotoğraf" value={data?.metrics.images || 0} helper="Görsel medya kayıtları" tone="info" />
              <MetricCard label="Vaka Bağlı" value={data?.metrics.linkedCases || 0} helper="Operation case ile eşleşen medya" tone="success" />
              <MetricCard label="Hasarlı Ürün" value={data?.metrics.damagedProduct || 0} helper="Hasarlı ürün kanıtları" tone="warning" />
            </section>

            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>Medya Kayıtları</div>
                  <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Fotoğraf, video, ses, doküman ve metadata kayıtları.</div>
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

              {rows.length === 0 ? <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 18, color: '#6b7280', background: '#f9fafb' }}>Seçili filtre için medya kaydı bulunmuyor.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>{rows.map((item) => <EvidenceMediaCard key={item.id} item={item} />)}</div>}
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
