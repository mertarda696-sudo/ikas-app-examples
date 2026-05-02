'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CustomerProfileLink } from '@/components/apparel-panel/CustomerProfileLink';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';

type OperationType =
  | 'all'
  | 'general'
  | 'return_exchange'
  | 'shipping_delivery'
  | 'size_consultation'
  | 'order_support'
  | 'payment_proof'
  | 'damaged_product'
  | 'hot_lead';

type OperationStatusFilter =
  | 'active'
  | 'all'
  | 'open'
  | 'in_progress'
  | 'waiting_customer'
  | 'resolved'
  | 'closed';

type OperationPriorityFilter =
  | 'all'
  | 'critical'
  | 'high'
  | 'normal'
  | 'low';

type OperationEvidenceFilter =
  | 'all'
  | 'has_evidence'
  | 'verified'
  | 'received'
  | 'requested'
  | 'missing'
  | 'rejected'
  | 'none';

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
  crmReviewedAt?: string | null;
  crmUpdatedAt?: string | null;
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

const TYPE_OPTIONS: Array<{ key: OperationType; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'return_exchange', label: 'İade / Değişim' },
  { key: 'shipping_delivery', label: 'Kargo / Teslimat' },
  { key: 'size_consultation', label: 'Beden Danışma' },
  { key: 'order_support', label: 'Sipariş Destek' },
  { key: 'payment_proof', label: 'Ödeme / Dekont' },
  { key: 'damaged_product', label: 'Hasarlı Ürün' },
  { key: 'hot_lead', label: 'Sıcak Lead' },
  { key: 'general', label: 'Genel' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Açık' },
  { value: 'in_progress', label: 'İnceleniyor' },
  { value: 'waiting_customer', label: 'Müşteri Bekleniyor' },
  { value: 'resolved', label: 'Çözüldü' },
  { value: 'closed', label: 'Kapalı' },
];

const STATUS_FILTER_OPTIONS: Array<{ key: OperationStatusFilter; label: string }> = [
  { key: 'active', label: 'Aktif Vakalar' },
  { key: 'all', label: 'Tüm Durumlar' },
  { key: 'open', label: 'Açık' },
  { key: 'in_progress', label: 'İnceleniyor' },
  { key: 'waiting_customer', label: 'Müşteri Bekleniyor' },
  { key: 'resolved', label: 'Çözüldü' },
  { key: 'closed', label: 'Kapalı' },
];

const PRIORITY_FILTER_OPTIONS: Array<{ key: OperationPriorityFilter; label: string }> = [
  { key: 'all', label: 'Tüm Öncelikler' },
  { key: 'critical', label: 'Kritik' },
  { key: 'high', label: 'Yüksek' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Düşük' },
];

const EVIDENCE_FILTER_OPTIONS: Array<{ key: OperationEvidenceFilter; label: string }> = [
  { key: 'all', label: 'Tüm Kanıt Durumları' },
  { key: 'has_evidence', label: 'Kanıt / Not Var' },
  { key: 'verified', label: 'Doğrulandı' },
  { key: 'received', label: 'Kanıt Alındı' },
  { key: 'requested', label: 'Kanıt İstendi' },
  { key: 'missing', label: 'Eksik' },
  { key: 'rejected', label: 'Reddedildi' },
  { key: 'none', label: 'Kanıt Yok' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function mapTypeLabel(type: string | null | undefined) {
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
  if (normalized === 'requested') return 'Kanıt istendi';
  if (normalized === 'received') return 'Kanıt alındı';
  if (normalized === 'verified') return 'Doğrulandı';
  if (normalized === 'missing') return 'Eksik';
  if (normalized === 'rejected') return 'Reddedildi';
  return state || 'Kanıt durumu yok';
}

function mapCrmTagLabel(tag: string | null | undefined) {
  const normalized = String(tag || 'general').toLowerCase();
  if (normalized === 'vip_customer') return 'VIP müşteri';
  if (normalized === 'risky_customer') return 'Riskli müşteri';
  if (normalized === 'high_return_tendency') return 'İade eğilimi yüksek';
  if (normalized === 'needs_followup') return 'Tekrar takip edilecek';
  if (normalized === 'delivery_issue') return 'Problemli teslimat';
  if (normalized === 'hot_lead') return 'Potansiyel sıcak lead';
  return 'Genel müşteri';
}

function mapRiskLevelLabel(level: string | null | undefined) {
  const normalized = String(level || 'normal').toLowerCase();
  if (normalized === 'low') return 'Düşük';
  if (normalized === 'high') return 'Yüksek';
  if (normalized === 'critical') return 'Kritik';
  return 'Normal';
}

function mapFollowupStatusLabel(status: string | null | undefined) {
  const normalized = String(status || 'none').toLowerCase();
  if (normalized === 'follow_up') return 'Takip edilecek';
  if (normalized === 'waiting_customer') return 'Müşteri bekleniyor';
  if (normalized === 'operator_action_required') return 'Operatör aksiyonu gerekli';
  return 'Takip gerekmiyor';
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
        fontWeight: 700,
        ...styles,
      }}
    >
      {label}
    </span>
  );
}

function priorityTone(priority: string | null | undefined) {
  if (priority === 'critical') return 'danger' as const;
  if (priority === 'high') return 'warning' as const;
  if (priority === 'low') return 'neutral' as const;
  return 'info' as const;
}

function statusTone(status: string | null | undefined) {
  if (status === 'resolved' || status === 'closed') return 'success' as const;
  if (status === 'open') return 'info' as const;
  if (status === 'in_progress') return 'warning' as const;
  return 'neutral' as const;
}

function riskTone(level: string | null | undefined) {
  if (level === 'critical' || level === 'high') return 'danger' as const;
  if (level === 'low') return 'success' as const;
  return 'info' as const;
}

function followupTone(status: string | null | undefined) {
  if (status === 'operator_action_required') return 'danger' as const;
  if (status === 'waiting_customer') return 'warning' as const;
  if (status === 'follow_up') return 'info' as const;
  return 'neutral' as const;
}

function isActiveCaseStatus(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'open' || normalized === 'in_progress' || normalized === 'waiting_customer';
}

function hasEvidenceSignal(item: OperationCaseItem) {
  return Boolean(
    String(item.evidenceSummary || '').trim() ||
    String(item.evidenceState || '').trim()
  );
}

function matchesEvidenceFilter(item: OperationCaseItem, filter: OperationEvidenceFilter) {
  const evidenceState = String(item.evidenceState || '').toLowerCase();

  if (filter === 'all') return true;
  if (filter === 'has_evidence') return hasEvidenceSignal(item);
  if (filter === 'none') return !hasEvidenceSignal(item);

  return evidenceState === filter;
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        background: '#ffffff',
        padding: 18,
      }}
    >
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
    </div>
  );
}

export default function OperationsPage() {
  const [activeType, setActiveType] = useState<OperationType>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<OperationStatusFilter>('active');
  const [activePriorityFilter, setActivePriorityFilter] = useState<OperationPriorityFilter>('all');
  const [activeEvidenceFilter, setActiveEvidenceFilter] = useState<OperationEvidenceFilter>('all');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<OperationCasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingCaseId, setUpdatingCaseId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const iframeToken = await TokenHelpers.getTokenForIframeApp();

        if (!iframeToken) {
          setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, metrics: { total: 0, open: 0, highPriority: 0, evidence: 0 }, items: [], error: 'iFrame JWT token alınamadı.' });
          return;
        }

        const response = await fetch('/api/apparel/operation-cases', {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = await response.json();
        setData(raw);
      } catch (error) {
        setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, metrics: { total: 0, open: 0, highPriority: 0, evidence: 0 }, items: [], error: error instanceof Error ? error.message : 'Unknown error' });
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
    const typeMatches = activeType === 'all' || item.caseType === activeType;

    const statusMatches =
  needle && activeStatusFilter === 'active'
    ? true
    : activeStatusFilter === 'all'
      ? true
      : activeStatusFilter === 'active'
        ? isActiveCaseStatus(item.status)
        : item.status === activeStatusFilter;

    const priority = String(item.priority || 'normal').toLowerCase();
    const priorityMatches =
      activePriorityFilter === 'all' || priority === activePriorityFilter;

    const evidenceMatches = matchesEvidenceFilter(item, activeEvidenceFilter);

    const haystack = [
      item.caseNo,
      item.caseType,
      item.title,
      item.description,
      item.customerWaId,
      item.linkedOrderId,
      item.status,
      item.priority,
      item.evidenceState,
      item.evidenceSummary,
      item.crmTag,
      item.riskLevel,
      item.followupStatus,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const queryMatches = !needle || haystack.includes(needle);

    return typeMatches && statusMatches && priorityMatches && evidenceMatches && queryMatches;
  });
}, [activeType, activeStatusFilter, activePriorityFilter, activeEvidenceFilter, items, query]);

  const metrics = data?.metrics || { total: 0, open: 0, highPriority: 0, evidence: 0 };
  const crmAlertCount = items.filter((item) => item.crmProfileExists && (item.riskLevel === 'high' || item.riskLevel === 'critical' || item.followupStatus === 'operator_action_required')).length;

  const handleUpdateCaseStatus = async (caseId: string, status: string) => {
    try {
      setActionError(null);
      setActionSuccess(null);
      setUpdatingCaseId(caseId);

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setActionError('iFrame JWT token alınamadı.');
        return;
      }

      const updateResponse = await fetch(`/api/apparel/operation-cases/${caseId}/status`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: 'JWT ' + iframeToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const updateRaw = await updateResponse.json();

      if (!updateResponse.ok || !updateRaw?.ok) {
        throw new Error(updateRaw?.error || 'Vaka durumu güncellenemedi.');
      }

      const listResponse = await fetch('/api/apparel/operation-cases', {
        cache: 'no-store',
        headers: { Authorization: 'JWT ' + iframeToken },
      });

      const listRaw = await listResponse.json();
      setData(listRaw);
      setActionSuccess(`Vaka durumu güncellendi: ${mapStatusLabel(status)}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Vaka durumu güncellenirken hata oluştu.');
    } finally {
      setUpdatingCaseId(null);
    }
  };

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Operasyonlar</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Konuşmalardan oluşturulan iade, kargo, ödeme, beden ve destek vakalarını canlı operasyon kuyruğunda izleyin.
            </p>
          </div>

          <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, background: '#ffffff', padding: 14, color: '#6b7280', maxWidth: 360, fontSize: 13, lineHeight: 1.6 }}>
            Bu sayfa artık placeholder değil. Kayıtlar Supabase operation_cases tablosundan canlı okunur.
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 700 }}>{data.error}</div>
        ) : (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
              <MetricCard label="Toplam Vaka" value={metrics.total} helper="Bu tenant için toplam operasyon kaydı." />
              <MetricCard label="Açık Vaka" value={metrics.open} helper="Açık, incelenen veya müşteri bekleyen vakalar." />
              <MetricCard label="Yüksek / Kritik" value={metrics.highPriority} helper="Yüksek veya kritik öncelikli kayıtlar." />
              <MetricCard label="CRM Uyarısı" value={crmAlertCount} helper="Riskli veya operatör aksiyonu isteyen müşteri vakaları." />
              <MetricCard label="Kanıt / Not İçeren" value={metrics.evidence} helper="Kanıt özeti veya kanıt durumu dolu vakalar." />
            </section>

            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18, marginBottom: 16 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Operasyon Filtreleri</div>
      <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
        Aktif filtrelerle {rows.length} vaka gösteriliyor.
      </div>
    </div>

    <button
      type="button"
      onClick={() => {
        setActiveType('all');
        setActiveStatusFilter('active');
        setActivePriorityFilter('all');
        setActiveEvidenceFilter('all');
        setQuery('');
      }}
      style={{
        border: '1px solid #d1d5db',
        background: '#ffffff',
        color: '#111827',
        borderRadius: 999,
        padding: '9px 14px',
        fontSize: 13,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      Filtreleri Sıfırla
    </button>
  </div>

  <input
    value={query}
    onChange={(event) => setQuery(event.target.value)}
    placeholder="Vaka no, müşteri, sipariş, başlık, açıklama veya kanıt durumunda ara..."
    style={{
      width: '100%',
      boxSizing: 'border-box',
      border: '1px solid #d1d5db',
      borderRadius: 14,
      padding: '12px 14px',
      marginBottom: 14,
      fontSize: 14,
    }}
  />

  <div style={{ display: 'grid', gap: 14 }}>
    <div>
      <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Durum</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {STATUS_FILTER_OPTIONS.map((option) => {
          const active = activeStatusFilter === option.key;
          return (
            <button key={option.key} onClick={() => setActiveStatusFilter(option.key)} style={{ border: active ? '1px solid #111827' : '1px solid #d1d5db', background: active ? '#111827' : '#ffffff', color: active ? '#ffffff' : '#111827', borderRadius: 999, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>

    <div>
      <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Vaka Tipi</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {TYPE_OPTIONS.map((option) => {
          const active = activeType === option.key;
          return (
            <button key={option.key} onClick={() => setActiveType(option.key)} style={{ border: active ? '1px solid #111827' : '1px solid #d1d5db', background: active ? '#111827' : '#ffffff', color: active ? '#ffffff' : '#111827', borderRadius: 999, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>

    <div>
      <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Öncelik</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {PRIORITY_FILTER_OPTIONS.map((option) => {
          const active = activePriorityFilter === option.key;
          return (
            <button key={option.key} onClick={() => setActivePriorityFilter(option.key)} style={{ border: active ? '1px solid #111827' : '1px solid #d1d5db', background: active ? '#111827' : '#ffffff', color: active ? '#ffffff' : '#111827', borderRadius: 999, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>

    <div>
      <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Kanıt Durumu</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {EVIDENCE_FILTER_OPTIONS.map((option) => {
          const active = activeEvidenceFilter === option.key;
          return (
            <button key={option.key} onClick={() => setActiveEvidenceFilter(option.key)} style={{ border: active ? '1px solid #111827' : '1px solid #d1d5db', background: active ? '#111827' : '#ffffff', color: active ? '#ffffff' : '#111827', borderRadius: 999, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  </div>
</section>

            {actionError ? <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>{actionError}</div> : null}
            {actionSuccess ? <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>{actionSuccess}</div> : null}

            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', overflow: 'hidden' }}>
              <div style={{ padding: 18, borderBottom: '1px solid #e5e7eb', fontSize: 18, fontWeight: 800 }}>Operasyon Listesi</div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Vaka No', 'Tip', 'Başlık', 'Müşteri', 'Sipariş', 'Öncelik', 'Durum', 'Kanıt', 'Son Güncelleme', 'Konuşma'].map((header) => (
                        <th key={header} style={{ textAlign: 'left', padding: 14, fontSize: 13, color: '#6b7280', fontWeight: 800, borderBottom: '1px solid #e5e7eb' }}>{header}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
  {rows.length > 0 ? (
    rows.map((row) => {
      const hasCrmSignal = Boolean(
        row.crmProfileExists &&
          (row.crmTag !== 'general' ||
            row.riskLevel !== 'normal' ||
            row.followupStatus !== 'none' ||
            row.crmInternalNote)
      );

      const detailHref = `/operations/${encodeURIComponent(row.id)}`;

      return (
        <tr key={row.id}>
          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'grid', gap: 6, minWidth: 150 }}>
              <div style={{ color: '#111827', fontWeight: 900 }}>
                {row.caseNo || row.id}
              </div>

              <Link
                href={detailHref}
                style={{
                  color: '#2563eb',
                  fontWeight: 900,
                  textDecoration: 'none',
                  fontSize: 13,
                }}
              >
                Vaka Detayına Git →
              </Link>
            </div>
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            <Pill label={mapTypeLabel(row.caseType)} tone="info" />
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontWeight: 800 }}>{row.title || '-'}</div>
            {row.description ? (
              <div style={{ marginTop: 4, color: '#6b7280', fontSize: 13, lineHeight: 1.5 }}>
                {row.description}
              </div>
            ) : null}
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'grid', gap: 6, minWidth: 190 }}>
              <span>{row.customerWaId || '-'}</span>
              <CustomerProfileLink customerWaId={row.customerWaId} compact />
              {hasCrmSignal ? <Pill label={`CRM: ${mapCrmTagLabel(row.crmTag)}`} tone="info" /> : null}
              {hasCrmSignal ? <Pill label={`Risk: ${mapRiskLevelLabel(row.riskLevel)}`} tone={riskTone(row.riskLevel)} /> : null}
              {hasCrmSignal ? <Pill label={`Takip: ${mapFollowupStatusLabel(row.followupStatus)}`} tone={followupTone(row.followupStatus)} /> : null}
              {row.crmInternalNote ? <Pill label="CRM notu var" tone="neutral" /> : null}
            </div>
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            {row.linkedOrderId || '-'}
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            <Pill label={mapPriorityLabel(row.priority)} tone={priorityTone(row.priority)} />
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'grid', gap: 8, minWidth: 170 }}>
              <Pill label={mapStatusLabel(row.status)} tone={statusTone(row.status)} />
              {row.status === 'resolved' || row.status === 'closed' ? <Pill label="Arşiv" tone="success" /> : null}

              <select
                value={row.status || 'open'}
                onChange={(event) => handleUpdateCaseStatus(row.id, event.target.value)}
                disabled={updatingCaseId === row.id}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 10,
                  padding: '8px 10px',
                  background: updatingCaseId === row.id ? '#f3f4f6' : '#ffffff',
                  color: '#111827',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: updatingCaseId === row.id ? 'not-allowed' : 'pointer',
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {updatingCaseId === row.id ? (
                <span style={{ color: '#6b7280', fontSize: 12 }}>Güncelleniyor...</span>
              ) : null}
            </div>
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            {row.evidenceSummary || row.evidenceState ? (
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{row.evidenceSummary || '-'}</span>
                <Pill label={mapEvidenceStateLabel(row.evidenceState)} tone="warning" />
              </div>
            ) : (
              '-'
            )}
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
            {formatDate(row.updatedAt || row.createdAt)}
          </td>

          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
            {row.conversationId ? (
              <Link
                href={`/inbox/${row.conversationId}`}
                style={{ textDecoration: 'none', color: '#111827', fontWeight: 700 }}
              >
                Konuşmaya Git →
              </Link>
            ) : (
              '-'
            )}
          </td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan={10} style={{ padding: 18, color: '#6b7280', lineHeight: 1.7 }}>
        Seçili filtrelerde gösterilecek operasyon kaydı bulunmuyor. Filtreleri sıfırlayarak tüm vakaları tekrar görebilirsiniz.
      </td>
    </tr>
  )}
</tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
