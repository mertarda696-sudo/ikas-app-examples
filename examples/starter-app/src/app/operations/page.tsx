'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
        {helper}
      </div>
    </div>
  );
}

export default function OperationsPage() {
  const [activeType, setActiveType] = useState<OperationType>('all');
  const [data, setData] = useState<OperationCasesResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

        const raw = await response.json();
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

  const rows = useMemo(() => {
    if (activeType === 'all') return items;
    return items.filter((item) => item.caseType === activeType);
  }, [activeType, items]);

  const metrics = data?.metrics || {
    total: 0,
    open: 0,
    highPriority: 0,
    evidence: 0,
  };

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
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
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
              Operasyonlar
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Konuşmalardan oluşturulan iade, kargo, ödeme, beden ve destek vakalarını canlı operasyon kuyruğunda izleyin.
            </p>
          </div>

          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              background: '#ffffff',
              padding: 14,
              color: '#6b7280',
              maxWidth: 360,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Bu sayfa artık placeholder değil. Kayıtlar Supabase operation_cases tablosundan canlı okunur.
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div
            style={{
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 14,
              padding: 16,
              fontWeight: 700,
            }}
          >
            {data.error}
          </div>
        ) : (
          <>
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <MetricCard label="Toplam Vaka" value={metrics.total} helper="Bu tenant için toplam operasyon kaydı." />
              <MetricCard label="Açık Vaka" value={metrics.open} helper="Açık, incelenen veya müşteri bekleyen vakalar." />
              <MetricCard label="Yüksek / Kritik" value={metrics.highPriority} helper="Yüksek veya kritik öncelikli kayıtlar." />
              <MetricCard label="Kanıt / Not İçeren" value={metrics.evidence} helper="Kanıt özeti veya kanıt durumu dolu vakalar." />
            </section>

            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                background: '#ffffff',
                padding: 18,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                Vaka Tipleri
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {TYPE_OPTIONS.map((option) => {
                  const active = activeType === option.key;

                  return (
                    <button
                      key={option.key}
                      onClick={() => setActiveType(option.key)}
                      style={{
                        border: active ? '1px solid #111827' : '1px solid #d1d5db',
                        background: active ? '#111827' : '#ffffff',
                        color: active ? '#ffffff' : '#111827',
                        borderRadius: 999,
                        padding: '9px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                background: '#ffffff',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Operasyon Listesi
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {[
                        'Vaka No',
                        'Tip',
                        'Başlık',
                        'Müşteri',
                        'Sipariş',
                        'Öncelik',
                        'Durum',
                        'Kanıt',
                        'Son Güncelleme',
                        'Konuşma',
                      ].map((header) => (
                        <th
                          key={header}
                          style={{
                            textAlign: 'left',
                            padding: 14,
                            fontSize: 13,
                            color: '#6b7280',
                            fontWeight: 800,
                            borderBottom: '1px solid #e5e7eb',
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>
                          {row.caseNo || '-'}
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
                          {row.customerWaId || '-'}
                        </td>

                        <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                          {row.linkedOrderId || '-'}
                        </td>

                        <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                          <Pill label={mapPriorityLabel(row.priority)} tone={priorityTone(row.priority)} />
                        </td>

                        <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                          <Pill label={mapStatusLabel(row.status)} tone={statusTone(row.status)} />
                        </td>

                        <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                          {row.evidenceSummary || row.evidenceState ? (
                            <div style={{ display: 'grid', gap: 4 }}>
                              <span>{row.evidenceSummary || '-'}</span>
                              <Pill label={row.evidenceState || 'Kanıt durumu yok'} tone="warning" />
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
                    ))}

                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: 18, color: '#6b7280' }}>
                          Seçili filtrede gösterilecek operasyon kaydı bulunmuyor.
                        </td>
                      </tr>
                    ) : null}
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
