'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { mapCrmTagLabel, mapFollowupStatusLabel } from '@/lib/apparel-panel/labels';

type OperatorActionSummaryMetrics = {
  waitingReplyConversationCount: number;
  openConversationCount: number;
  closedConversationCount: number;
  productContextConversationCount: number;
  crmAlertConversationCount: number;
  riskyCustomerCount: number;
  totalOperationCaseCount: number;
  openOperationCaseCount: number;
  highPriorityOperationCaseCount: number;
  evidenceOperationCaseCount: number;
};

type OperatorActionSummaryItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  priority: string | null;
  status: string | null;
  customerWaId: string | null;
  linkedOrderId: string | null;
  conversationId: string | null;
  crmTag: string | null;
  riskLevel: string | null;
  followupStatus: string | null;
  updatedAt: string | null;
};

type OperatorActionSummaryResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  metrics: OperatorActionSummaryMetrics | null;
  priorityItems: OperatorActionSummaryItem[];
  error?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
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

function mapRiskLabel(riskLevel: string | null | undefined) {
  if (riskLevel === 'critical') return 'Kritik risk';
  if (riskLevel === 'high') return 'Yüksek risk';
  if (riskLevel === 'low') return 'Düşük risk';
  return 'Normal risk';
}

function Badge({ label, tone }: { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' }) {
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

function MetricTile({ label, value, helper, tone }: { label: string; value: number; helper: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' }) {
  const borderColor = tone === 'danger' ? '#fecaca' : tone === 'warning' ? '#fde68a' : tone === 'success' ? '#bbf7d0' : tone === 'info' ? '#bfdbfe' : '#e5e7eb';

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 16, background: '#ffffff', padding: 14 }}>
      <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#111827', fontSize: 28, fontWeight: 900 }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>{helper}</div>
    </div>
  );
}

function priorityTone(priority: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'low') return 'neutral';
  return 'info';
}

function riskTone(riskLevel: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (riskLevel === 'critical' || riskLevel === 'high') return 'danger';
  if (riskLevel === 'low') return 'success';
  return 'info';
}

function followupTone(followupStatus: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (followupStatus === 'operator_action_required') return 'danger';
  if (followupStatus === 'waiting_customer') return 'warning';
  if (followupStatus === 'follow_up') return 'info';
  return 'neutral';
}

export function OperatorActionSummaryBox() {
  const [data, setData] = useState<OperatorActionSummaryResponse | null>(null);
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
            metrics: null,
            priorityItems: [],
            error: 'iFrame JWT token alınamadı.',
          });
          return;
        }

        const response = await fetch('/api/apparel/operator-action-summary', {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = (await response.json()) as OperatorActionSummaryResponse;
        setData(raw);
      } catch (error) {
        setData({
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          metrics: null,
          priorityItems: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const metrics = data?.metrics || null;
  const priorityItems = data?.priorityItems || [];

  const headline = useMemo(() => {
    if (!metrics) return 'Operasyon özeti yükleniyor';
    if (metrics.waitingReplyConversationCount > 0) return 'Yanıt bekleyen konuşmalar var';
    if (metrics.highPriorityOperationCaseCount > 0 || metrics.riskyCustomerCount > 0) return 'Öncelikli takip var';
    if (metrics.openOperationCaseCount > 0) return 'Açık operasyon vakaları var';
    return 'Operasyon kuyruğu sakin görünüyor';
  }, [metrics]);

  const headlineTone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' = !metrics
    ? 'neutral'
    : metrics.waitingReplyConversationCount > 0
      ? 'danger'
      : metrics.highPriorityOperationCaseCount > 0 || metrics.riskyCustomerCount > 0
        ? 'warning'
        : metrics.openOperationCaseCount > 0
          ? 'info'
          : 'success';

  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            Operatör Aksiyon Merkezi
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', marginBottom: 6 }}>{headline}</div>
          <div style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7 }}>
            Yanıt bekleyen konuşmalar, açık vakalar, CRM riskleri ve kanıt/not içeren operasyonlar tek özet halinde gösterilir.
          </div>
        </div>
        <Badge label={loading ? 'Yükleniyor' : data?.ok ? 'Canlı veri' : 'Kontrol gerekli'} tone={loading ? 'neutral' : data?.ok ? headlineTone : 'danger'} />
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Operasyon aksiyon özeti yükleniyor...</div>
      ) : data?.error ? (
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800 }}>
          {data.error}
        </div>
      ) : metrics ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <MetricTile label="Yanıt Bekleyen" value={metrics.waitingReplyConversationCount} helper="Operatör cevabı veya incelemesi bekleyen konuşmalar" tone={metrics.waitingReplyConversationCount > 0 ? 'danger' : 'success'} />
            <MetricTile label="Açık Vaka" value={metrics.openOperationCaseCount} helper="Açık, incelenen veya müşteri bekleyen operasyon kayıtları" tone={metrics.openOperationCaseCount > 0 ? 'info' : 'success'} />
            <MetricTile label="Yüksek / Kritik" value={metrics.highPriorityOperationCaseCount} helper="Yüksek veya kritik öncelikli operasyon vakaları" tone={metrics.highPriorityOperationCaseCount > 0 ? 'danger' : 'success'} />
            <MetricTile label="Riskli Müşteri" value={metrics.riskyCustomerCount} helper="CRM tarafında risk veya aksiyon işaretli tekil müşteri" tone={metrics.riskyCustomerCount > 0 ? 'warning' : 'success'} />
            <MetricTile label="CRM Uyarılı Konuşma" value={metrics.crmAlertConversationCount} helper="Riskli/takipli müşterilere ait konuşmalar" tone={metrics.crmAlertConversationCount > 0 ? 'warning' : 'success'} />
            <MetricTile label="Kanıt / Not" value={metrics.evidenceOperationCaseCount} helper="Açıklama, kanıt veya not içeren operasyon vakaları" tone={metrics.evidenceOperationCaseCount > 0 ? 'info' : 'neutral'} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/inbox" style={{ textDecoration: 'none', borderRadius: 12, padding: '9px 13px', background: '#111827', color: '#ffffff', fontWeight: 800, fontSize: 13 }}>
              Mesajları Aç →
            </Link>
            <Link href="/operations" style={{ textDecoration: 'none', borderRadius: 12, padding: '9px 13px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 800, fontSize: 13 }}>
              Operasyonları Aç →
            </Link>
          </div>

          {priorityItems.length > 0 ? (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#111827', marginBottom: 10 }}>Öncelikli takip listesi</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {priorityItems.map((item) => (
                  <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#f9fafb', padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <Badge label={mapPriorityLabel(item.priority)} tone={priorityTone(item.priority)} />
                      <Badge label={mapStatusLabel(item.status)} tone="info" />
                      <Badge label={mapRiskLabel(item.riskLevel)} tone={riskTone(item.riskLevel)} />
                      {item.crmTag && item.crmTag !== 'general' ? <Badge label={mapCrmTagLabel(item.crmTag)} tone="info" /> : null}
                      {item.followupStatus && item.followupStatus !== 'none' ? <Badge label={mapFollowupStatusLabel(item.followupStatus)} tone={followupTone(item.followupStatus)} /> : null}
                    </div>
                    <div style={{ fontWeight: 900, color: '#111827', marginBottom: 4 }}>{item.title}</div>
                    <div style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{item.detail}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Link href={item.href} style={{ color: '#111827', fontWeight: 900, textDecoration: 'none', fontSize: 13 }}>
                          {item.cta} →
                        </Link>
                        {item.customerWaId ? (
                          <Link href={`/customers/${encodeURIComponent(item.customerWaId)}`} style={{ color: '#111827', fontWeight: 900, textDecoration: 'none', fontSize: 13 }}>
                            Müşteri Profiline Git →
                          </Link>
                        ) : null}
                      </div>
                      <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 700 }}>{formatDate(item.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
