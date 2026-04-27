'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { CustomerProfileLink } from '@/components/apparel-panel/CustomerProfileLink';
import { TokenHelpers } from '@/helpers/token-helpers';

type EvidenceFilter =
  | 'all'
  | 'has_evidence'
  | 'requested'
  | 'received'
  | 'verified'
  | 'missing'
  | 'rejected'
  | 'damaged_product'
  | 'payment_proof'
  | 'shipping_delivery'
  | 'return_exchange';

type OperationCaseItem = {
  id: string;
  caseNo: string | null;
  caseType: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  sourceChannel: string | null;
  customerWaId: string | null;
  linkedOrderId: string | null;
  evidenceSummary: string | null;
  evidenceState: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  conversationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  crmProfileExists?: boolean;
  crmTag?: string | null;
  riskLevel?: string | null;
  followupStatus?: string | null;
  crmInternalNote?: string | null;
};

type OperationCasesResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  metrics: {
    total: number;
    open: number;
    highPriority: number;
    evidence: number;
  };
  items: OperationCaseItem[];
  error?: string;
};

const FILTERS: Array<{ key: EvidenceFilter; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'has_evidence', label: 'Kanıt / Not İçeren' },
  { key: 'requested', label: 'Kanıt İstendi' },
  { key: 'received', label: 'Kanıt Alındı' },
  { key: 'verified', label: 'Doğrulandı' },
  { key: 'missing', label: 'Eksik' },
  { key: 'rejected', label: 'Reddedildi' },
  { key: 'damaged_product', label: 'Hasarlı Ürün' },
  { key: 'payment_proof', label: 'Ödeme / Dekont' },
  { key: 'shipping_delivery', label: 'Kargo / Teslimat' },
  { key: 'return_exchange', label: 'İade / Değişim' },
];

const EVIDENCE_STATE_FILTERS = new Set<EvidenceFilter>([
  'requested',
  'received',
  'verified',
  'missing',
  'rejected',
]);

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function mapCaseTypeLabel(type: string | null | undefined) {
  if (type === 'damaged_product') return 'Hasarlı Ürün';
  if (type === 'shipping_delivery') return 'Kargo / Teslimat';
  if (type === 'payment_proof') return 'Ödeme / Dekont';
  if (type === 'return_exchange') return 'İade / Değişim';
  if (type === 'size_consultation') return 'Beden Danışma';
  if (type === 'order_support') return 'Sipariş Destek';
  if (type === 'hot_lead') return 'Sıcak Lead';
  return 'Genel';
}

function mapPriorityLabel(priority: string | null | undefined) {
  if (priority === 'critical') return 'Kritik';
  if (priority === 'high') return 'Yüksek';
  if (priority === 'low') return 'Düşük';
  return 'Normal';
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
  const normalized = String(state || '').toLowerCase();
  if (normalized === 'received') return 'Kanıt alındı';
  if (normalized === 'requested') return 'Kanıt istendi';
  if (normalized === 'verified') return 'Doğrulandı';
  if (normalized === 'rejected') return 'Reddedildi';
  if (normalized === 'missing') return 'Eksik';
  return state || 'Kanıt durumu yok';
}

function mapRiskLabel(level: string | null | undefined) {
  if (level === 'critical') return 'Kritik risk';
  if (level === 'high') return 'Yüksek risk';
  if (level === 'low') return 'Düşük risk';
  return 'Normal risk';
}

function hasEvidenceSignal(item: OperationCaseItem) {
  return Boolean(
    String(item.evidenceSummary || '').trim() ||
      String(item.evidenceState || '').trim() ||
      item.caseType === 'damaged_product' ||
      item.caseType === 'payment_proof' ||
      item.caseType === 'shipping_delivery' ||
      item.caseType === 'return_exchange',
  );
}

function priorityTone(priority: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'low') return 'neutral';
  return 'info';
}

function statusTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'open') return 'info';
  if (status === 'in_progress' || status === 'waiting_customer') return 'warning';
  return 'neutral';
}

function evidenceTone(state: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (state === 'verified') return 'success';
  if (state === 'received') return 'info';
  if (state === 'requested' || state === 'missing') return 'warning';
  if (state === 'rejected') return 'danger';
  return 'neutral';
}

function riskTone(level: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (level === 'critical' || level === 'high') return 'danger';
  if (level === 'low') return 'success';
  return 'info';
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

  return (
    <span style={{ display: 'inline-flex', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 800, ...styles }}>
      {label}
    </span>
  );
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

export default function EvidencePage() {
  const [data, setData] = useState<OperationCasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<EvidenceFilter>('all');

  useEffect(() => {
    const run = async () => {
      try {
        const iframeToken = await TokenHelpers.getTokenForIframeApp();

        if (!iframeToken) {
          setData({
            ok: false,
            fetchedAt: new Date().toISOString(),
            tenant: null,
            metrics: { total: 0, open: 0, highPriority: 0, evidence: 0 },
            items: [],
            error: 'iFrame JWT token alınamadı.',
          });
          return;
        }

        const response = await fetch('/api/apparel/operation-cases', {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = (await response.json()) as OperationCasesResponse;
        setData(raw);
      } catch (error) {
        setData({
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          metrics: { total: 0, open: 0, highPriority: 0, evidence: 0 },
          items: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const items = data?.items || [];

  const metrics = useMemo(() => {
    const evidenceCandidateCount = items.filter(hasEvidenceSignal).length;
    const requestedCount = items.filter((item) => item.evidenceState === 'requested').length;
    const receivedCount = items.filter((item) => item.evidenceState === 'received').length;
    const verifiedCount = items.filter((item) => item.evidenceState === 'verified').length;
    const problemEvidenceCount = items.filter((item) => item.evidenceState === 'missing' || item.evidenceState === 'rejected').length;
    const damagedCount = items.filter((item) => item.caseType === 'damaged_product').length;

    return {
      evidenceCandidateCount,
      requestedCount,
      receivedCount,
      verifiedCount,
      problemEvidenceCount,
      damagedCount,
    };
  }, [items]);

  const rows = useMemo(() => {
    const filtered = items.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'has_evidence') return hasEvidenceSignal(item);
      if (EVIDENCE_STATE_FILTERS.has(activeFilter)) return item.evidenceState === activeFilter;
      return item.caseType === activeFilter;
    });

    return [...filtered].sort((a, b) => {
      const aEvidence = hasEvidenceSignal(a) ? 1 : 0;
      const bEvidence = hasEvidenceSignal(b) ? 1 : 0;
      if (aEvidence !== bEvidence) return bEvidence - aEvidence;

      const priorityRank = (priority: string | null | undefined) => {
        if (priority === 'critical') return 4;
        if (priority === 'high') return 3;
        if (priority === 'normal') return 2;
        if (priority === 'low') return 1;
        return 0;
      };

      const ap = priorityRank(a.priority);
      const bp = priorityRank(b.priority);
      if (ap !== bp) return bp - ap;

      const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bt - at;
    });
  }, [activeFilter, items]);

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>
              Operasyon Kanıt Katmanı
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 8px', color: '#111827' }}>
              Kanıt / Medya Merkezi
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7, maxWidth: 820 }}>
              Hasarlı ürün fotoğrafı, ödeme dekontu, kargo paketi videosu ve iade/değişim kanıtları için panel zeminini hazırlar. Bu v1 sürümünde operasyon vakalarındaki kanıt özeti ve kanıt durumu canlı okunur.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/operator-actions" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#111827', color: '#ffffff', fontWeight: 800 }}>
              Aksiyon Merkezi →
            </Link>
            <Link href="/operations" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 800 }}>
              Operasyonlar →
            </Link>
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 800 }}>{data.error}</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              <MetricCard label="Toplam Kanıt Adayı" value={metrics.evidenceCandidateCount} helper="Kanıt özeti, kanıt durumu veya medya gerektirebilecek operasyon kayıtları" tone={metrics.evidenceCandidateCount > 0 ? 'info' : 'neutral'} />
              <MetricCard label="Kanıt İstendi" value={metrics.requestedCount} helper="Müşteriden belge, görsel veya ek bilgi beklenen vakalar" tone={metrics.requestedCount > 0 ? 'warning' : 'success'} />
              <MetricCard label="Kanıt Alındı" value={metrics.receivedCount} helper="Operatör doğrulaması bekleyen kanıt kayıtları" tone={metrics.receivedCount > 0 ? 'info' : 'neutral'} />
              <MetricCard label="Doğrulandı" value={metrics.verifiedCount} helper="Kanıtı onaylanmış operasyon vakaları" tone={metrics.verifiedCount > 0 ? 'success' : 'neutral'} />
              <MetricCard label="Eksik / Reddedildi" value={metrics.problemEvidenceCount} helper="Eksik veya reddedilmiş kanıt süreci olan vakalar" tone={metrics.problemEvidenceCount > 0 ? 'danger' : 'success'} />
              <MetricCard label="Hasarlı Ürün" value={metrics.damagedCount} helper="Fotoğraf/video kanıtı gerektirebilecek hasarlı ürün vakaları" tone={metrics.damagedCount > 0 ? 'warning' : 'success'} />
            </section>

            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>Kanıt Kuyruğu</div>
                  <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Operasyon vakalarını kanıt/medya ihtiyacına ve kanıt durumuna göre takip edin.</div>
                </div>
                <Pill label={`${rows.length} kayıt`} tone="neutral" />
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {FILTERS.map((filter) => {
                  const active = activeFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => setActiveFilter(filter.key)}
                      style={{
                        border: active ? '1px solid #111827' : '1px solid #d1d5db',
                        background: active ? '#111827' : '#ffffff',
                        color: active ? '#ffffff' : '#111827',
                        borderRadius: 999,
                        padding: '9px 14px',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {rows.length === 0 ? (
                <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 18, color: '#6b7280', background: '#f9fafb' }}>
                  Seçili filtre için kanıt/medya ilişkili kayıt bulunmuyor.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {rows.map((item) => {
                    const hasCrmSignal = Boolean(item.crmProfileExists && (item.riskLevel === 'high' || item.riskLevel === 'critical' || item.followupStatus === 'operator_action_required' || item.crmInternalNote));

                    return (
                      <div key={item.id} style={{ border: hasEvidenceSignal(item) ? '1px solid #bfdbfe' : '1px solid #e5e7eb', borderRadius: 16, background: '#ffffff', padding: 14 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          <Pill label={item.caseNo || 'Vaka'} tone="info" />
                          <Pill label={mapCaseTypeLabel(item.caseType)} tone="warning" />
                          <Pill label={mapStatusLabel(item.status)} tone={statusTone(item.status)} />
                          <Pill label={`Öncelik: ${mapPriorityLabel(item.priority)}`} tone={priorityTone(item.priority)} />
                          <Pill label={mapEvidenceStateLabel(item.evidenceState)} tone={evidenceTone(item.evidenceState)} />
                          {hasCrmSignal ? <Pill label={mapRiskLabel(item.riskLevel)} tone={riskTone(item.riskLevel)} /> : null}
                        </div>

                        <div style={{ fontSize: 17, fontWeight: 900, color: '#111827', marginBottom: 6 }}>
                          {item.title || 'Başlıksız operasyon kaydı'}
                        </div>

                        {item.description ? (
                          <div style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                            {item.description}
                          </div>
                        ) : null}

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 0.8fr)', gap: 12, alignItems: 'start' }}>
                          <div style={{ border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 14, padding: 12, color: '#374151', fontSize: 13, lineHeight: 1.7 }}>
                            <div><strong>Kanıt özeti:</strong> {item.evidenceSummary || 'Henüz kanıt özeti yok.'}</div>
                            <div><strong>Kanıt durumu:</strong> {mapEvidenceStateLabel(item.evidenceState)}</div>
                            <div><strong>Kaynak kanal:</strong> {item.sourceChannel || 'whatsapp'}</div>
                            <div><strong>Son güncelleme:</strong> {formatDate(item.updatedAt || item.createdAt)}</div>
                          </div>

                          <div style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 14, padding: 12, color: '#374151', fontSize: 13, lineHeight: 1.7 }}>
                            <div><strong>Müşteri:</strong> {item.customerWaId || '-'}</div>
                            <div><strong>Sipariş:</strong> {item.linkedOrderId || '-'}</div>
                            <div><strong>Konuşma:</strong> {item.conversationId ? 'Bağlı' : 'Bağ yok'}</div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                              <Link href={`/operations/${item.caseNo || item.id}`} style={{ color: '#2563eb', fontWeight: 900, textDecoration: 'none' }}>Vaka Detayına Git →</Link>
                              {item.conversationId ? <Link href={`/inbox/${item.conversationId}`} style={{ color: '#111827', fontWeight: 900, textDecoration: 'none' }}>Konuşmaya Git →</Link> : null}
                              <CustomerProfileLink customerWaId={item.customerWaId} compact />
                              {item.linkedOrderId ? <Link href={`/orders/${item.linkedOrderId}`} style={{ color: '#111827', fontWeight: 900, textDecoration: 'none' }}>Siparişe Git →</Link> : null}
                              <Link href="/operations" style={{ color: '#111827', fontWeight: 900, textDecoration: 'none' }}>Operasyonlara Git →</Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
