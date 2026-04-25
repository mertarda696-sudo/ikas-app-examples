'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { CustomerProfileLink } from '@/components/apparel-panel/CustomerProfileLink';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { InboxListResponse } from '@/lib/apparel-panel/types';
import {
  inferLinkedOrderId,
  inferPriorityLabel,
  getConversationQueueHint,
} from '@/lib/apparel-panel/panel-relations';

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

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function mapChannelLabel(channel: string | null | undefined) {
  const normalized = String(channel || '').toLowerCase();
  if (normalized === 'whatsapp') return 'WhatsApp';
  if (normalized === 'instagram') return 'Instagram';
  if (normalized === 'email') return 'E-posta';
  return channel || 'Kanal';
}

function mapSenderLabel(senderType: string | null | undefined, direction?: 'in' | 'out' | null) {
  if (senderType === 'customer') return 'Müşteri';
  if (senderType === 'operator') return 'Operatör';
  if (senderType === 'ai') return 'AI Asistan';
  if (senderType === 'system') return 'Sistem';
  if (direction === 'in') return 'Müşteri';
  if (direction === 'out') return 'AI Asistan';
  return 'Bilinmiyor';
}

function mapStatusLabel(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'open') return 'Açık';
  if (normalized === 'closed') return 'Kapalı';
  return status || '-';
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

function mapCaseStatusLabel(status: string | null | undefined) {
  if (status === 'open') return 'Açık';
  if (status === 'in_progress') return 'İnceleniyor';
  if (status === 'waiting_customer') return 'Müşteri Bekleniyor';
  if (status === 'resolved') return 'Çözüldü';
  if (status === 'closed') return 'Kapalı';
  return status || '-';
}

function mapCasePriorityLabel(priority: string | null | undefined) {
  if (priority === 'critical') return 'Kritik';
  if (priority === 'high') return 'Yüksek';
  if (priority === 'low') return 'Düşük';
  return 'Normal';
}

function mapOperatorTagLabel(tag: string | null | undefined) {
  const normalized = String(tag || '').toLowerCase();
  if (normalized === 'general_followup') return 'Genel takip';
  if (normalized === 'hot_lead') return 'Sıcak lead';
  if (normalized === 'order_support') return 'Sipariş destek';
  if (normalized === 'return_exchange') return 'İade / değişim';
  if (normalized === 'size_consultation') return 'Beden danışma';
  if (normalized === 'shipping_delivery') return 'Kargo / teslimat';
  return tag || '';
}

function mapOperatorPriorityLabel(priority: string | null | undefined) {
  const normalized = String(priority || 'normal').toLowerCase();
  if (normalized === 'high') return 'Yüksek öncelik';
  if (normalized === 'low') return 'Düşük öncelik';
  return 'Normal öncelik';
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

function getOperatorPriorityTone(priority: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  const normalized = String(priority || 'normal').toLowerCase();
  if (normalized === 'high') return 'danger';
  if (normalized === 'low') return 'neutral';
  return 'info';
}

function getRiskLevelTone(level: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  const normalized = String(level || 'normal').toLowerCase();
  if (normalized === 'critical') return 'danger';
  if (normalized === 'high') return 'danger';
  if (normalized === 'low') return 'success';
  return 'info';
}

function getFollowupStatusTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  const normalized = String(status || 'none').toLowerCase();
  if (normalized === 'operator_action_required') return 'danger';
  if (normalized === 'waiting_customer') return 'warning';
  if (normalized === 'follow_up') return 'info';
  return 'neutral';
}

function getCasePriorityTone(priority: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'low') return 'neutral';
  return 'info';
}

function getCaseStatusTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'open') return 'info';
  if (status === 'in_progress') return 'warning';
  if (status === 'resolved' || status === 'closed') return 'success';
  return 'neutral';
}

function SmallBadge({
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

function getStatusTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'open') return 'success';
  if (normalized === 'closed') return 'neutral';
  return 'info';
}

function isAfter(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return false;
  if (!b) return true;
  const at = new Date(a).getTime();
  const bt = new Date(b).getTime();
  return Number.isFinite(at) && Number.isFinite(bt) ? at > bt : false;
}

function getResponseState(item: InboxListResponse['items'][number]) {
  const isOpen = String(item.status || '').toLowerCase() === 'open';
  const customerAfterOperator = isAfter(item.lastCustomerMessageAt, item.lastOperatorMessageAt);
  const customerAfterReview = isAfter(item.lastCustomerMessageAt, item.operatorReviewedAt);
  const needsReply = isOpen && customerAfterOperator && customerAfterReview;
  const reviewedAfterCustomer = Boolean(item.operatorReviewedAt) && !customerAfterReview;

  return {
    needsReply,
    reviewedAfterCustomer,
    label: needsReply ? 'Yanıt bekliyor' : reviewedAfterCustomer ? 'İncelendi' : 'Cevaplandı',
    tone: needsReply ? ('danger' as const) : reviewedAfterCustomer ? ('info' as const) : ('success' as const),
  };
}

export default function InboxPage() {
  const [data, setData] = useState<InboxListResponse | null>(null);
  const [operationCases, setOperationCases] = useState<OperationCaseItem[]>([]);
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
            items: [],
            error: 'iFrame JWT token alınamadı.',
          });
          return;
        }

        const [inboxResponse, casesResponse] = await Promise.all([
          fetch('/api/apparel/inbox', {
            cache: 'no-store',
            headers: { Authorization: 'JWT ' + iframeToken },
          }),
          fetch('/api/apparel/operation-cases', {
            cache: 'no-store',
            headers: { Authorization: 'JWT ' + iframeToken },
          }),
        ]);

        const rawInbox = await inboxResponse.json();
        const rawCases = (await casesResponse.json()) as OperationCasesResponse;

        setData(rawInbox);
        setOperationCases(rawCases?.ok ? rawCases.items || [] : []);
      } catch (error) {
        setData({
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          items: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        setOperationCases([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const items = useMemo(() => data?.items || [], [data?.items]);
  const casesByConversation = useMemo(() => {
    const map = new Map<string, OperationCaseItem[]>();
    for (const operationCase of operationCases) {
      if (!operationCase.conversationId) continue;
      const existing = map.get(operationCase.conversationId) || [];
      existing.push(operationCase);
      map.set(operationCase.conversationId, existing);
    }
    return map;
  }, [operationCases]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const ar = getResponseState(a).needsReply ? 1 : 0;
        const br = getResponseState(b).needsReply ? 1 : 0;
        if (ar !== br) return br - ar;

        const ac = casesByConversation.get(a.id)?.length ? 1 : 0;
        const bc = casesByConversation.get(b.id)?.length ? 1 : 0;
        if (ac !== bc) return bc - ac;

        const ap = a.operatorPriority === 'high' ? 1 : 0;
        const bp = b.operatorPriority === 'high' ? 1 : 0;
        if (ap !== bp) return bp - ap;

        const riskRank = (value: string | null | undefined) => {
          if (value === 'critical') return 3;
          if (value === 'high') return 2;
          if (value === 'normal') return 1;
          return 0;
        };
        const arisk = riskRank(a.riskLevel);
        const brisk = riskRank(b.riskLevel);
        if (arisk !== brisk) return brisk - arisk;

        const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bt - at;
      }),
    [items, casesByConversation],
  );

  const metrics = useMemo(() => {
    const openCount = items.filter((item) => String(item.status).toLowerCase() === 'open').length;
    const closedCount = items.filter((item) => String(item.status).toLowerCase() === 'closed').length;
    const productContextCount = items.filter((item) => item.contextProductName).length;
    const waitingReplyCount = items.filter((item) => getResponseState(item).needsReply).length;
    const crmAlertCount = items.filter((item) => item.crmProfileExists && (item.riskLevel === 'high' || item.riskLevel === 'critical' || item.followupStatus === 'operator_action_required')).length;

    return { openCount, closedCount, productContextCount, waitingReplyCount, crmAlertCount };
  }, [items]);

  return (
    <AppShell>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Mesajlar</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Bu ekran konuşmaları yalnız mesaj listesi gibi değil, operatörün önceliklendireceği müşteri olay kuyruğu gibi gösterir.
            </p>
          </div>

          <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, background: '#ffffff', padding: 14, color: '#6b7280', maxWidth: 400, fontSize: 13, lineHeight: 1.6 }}>
            “Yanıt Bekleyen Mesaj”, son müşteri mesajından sonra operatör manuel cevap vermediyse ve konuşma incelenmediyse artar. AI cevabı bu sayacı kapatmaz.
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 600 }}>
            {data.error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 20, background: '#ffffff', color: '#6b7280' }}>
            Bu tenant için henüz konuşma görünmüyor. WhatsApp bağlı değilse bu ekranın boş gelmesi normaldir.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <MetricCard label="Açık Konuşma" value={metrics.openCount} helper="Aktif müşteri konuşmaları" />
              <MetricCard label="Yanıt Bekleyen Mesaj" value={metrics.waitingReplyCount} helper="Operatör cevabı veya incelemesi bekleyen açık konuşmalar" />
              <MetricCard label="Ürün Bağlamlı" value={metrics.productContextCount} helper="Aktif ürün bağlamı olan konuşmalar" />
              <MetricCard label="CRM Uyarısı" value={metrics.crmAlertCount} helper="Yüksek riskli veya operatör aksiyonu isteyen müşteriler" />
              <MetricCard label="Kapalı Konuşma" value={metrics.closedCount} helper="Kapanmış kayıtlar" />
            </section>

            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Operatör Konuşma Kuyruğu</div>

              <div style={{ display: 'grid', gap: 14 }}>
                {sortedItems.map((item) => {
                  const linkedOrderId = inferLinkedOrderId(item.lastMessageText, item.contextProductName);
                  const linkedCases = casesByConversation.get(item.id) || [];
                  const linkedCase = linkedCases[0] || null;
                  const linkedCaseCount = linkedCases.length;
                  const priorityLabel = inferPriorityLabel(item.lastMessageText);
                  const recommendation = getConversationQueueHint(item);
                  const responseState = getResponseState(item);
                  const hasOperatorNote = Boolean(String(item.operatorNote || '').trim());
                  const hasOperatorTag = Boolean(String(item.operatorTag || '').trim());
                  const operatorPriority = String(item.operatorPriority || 'normal').toLowerCase();
                  const hasCrmSignal = Boolean(item.crmProfileExists && (item.crmTag !== 'general' || item.riskLevel !== 'normal' || item.followupStatus !== 'none' || item.crmInternalNote));
                  const hasCriticalCrmSignal = item.riskLevel === 'critical' || item.riskLevel === 'high' || item.followupStatus === 'operator_action_required';

                  const recommendationBoxStyle =
                    responseState.needsReply
                      ? { border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }
                      : hasCriticalCrmSignal
                        ? { border: '1px solid #fecaca', background: '#fff7ed', color: '#9a3412' }
                        : linkedCase
                          ? { border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8' }
                          : operatorPriority === 'high'
                            ? { border: '1px solid #fecaca', background: '#fff7ed', color: '#9a3412' }
                            : responseState.reviewedAfterCustomer
                              ? { border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8' }
                              : recommendation.tone === 'success'
                                ? { border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534' }
                                : recommendation.tone === 'warning'
                                  ? { border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e' }
                                  : recommendation.tone === 'info'
                                    ? { border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8' }
                                    : { border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151' };

                  return (
                    <div
                      key={item.id}
                      style={{ textDecoration: 'none', border: responseState.needsReply || operatorPriority === 'high' || linkedCase || hasCriticalCrmSignal ? '1px solid #bfdbfe' : '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18, color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.95fr)', gap: 16, alignItems: 'stretch' }}>
                        <div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>{item.customerDisplay}</div>
                            <SmallBadge label={mapChannelLabel(item.channel)} tone="info" />
                            <SmallBadge label={mapStatusLabel(item.status)} tone={getStatusTone(item.status)} />
                            <SmallBadge label={responseState.label} tone={responseState.tone} />
                            {hasOperatorTag ? <SmallBadge label={mapOperatorTagLabel(item.operatorTag)} tone="warning" /> : null}
                            {item.operatorPriority ? <SmallBadge label={mapOperatorPriorityLabel(item.operatorPriority)} tone={getOperatorPriorityTone(item.operatorPriority)} /> : null}
                            {hasOperatorNote ? <SmallBadge label="Not var" tone="neutral" /> : null}
                            {hasCrmSignal ? <SmallBadge label="CRM kaydı var" tone={hasCriticalCrmSignal ? 'danger' : 'info'} /> : null}
                          </div>

                          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>
                            <strong>{mapSenderLabel(item.lastMessageSenderType, item.lastMessageDirection)}:</strong>{' '}
                            {item.lastMessageText || 'Mesaj metni bulunmuyor.'}
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                            <SmallBadge label={priorityLabel} tone="warning" />
                            <SmallBadge label={linkedOrderId ? `Bağlı sipariş: ${linkedOrderId}` : 'Sipariş bağı henüz yok'} tone={linkedOrderId ? 'info' : 'neutral'} />
                            <SmallBadge label={linkedCase ? (linkedCaseCount > 1 ? `Bağlı vaka: ${linkedCase.caseNo || 'Vaka'} +${linkedCaseCount - 1}` : `Bağlı vaka: ${linkedCase.caseNo || 'Vaka'}`) : 'Vaka bağı henüz yok'} tone={linkedCase ? 'info' : 'neutral'} />
                            {linkedCase ? <SmallBadge label={mapCaseTypeLabel(linkedCase.caseType)} tone="warning" /> : null}
                            {linkedCase?.priority ? <SmallBadge label={`Vaka önceliği: ${mapCasePriorityLabel(linkedCase.priority)}`} tone={getCasePriorityTone(linkedCase.priority)} /> : null}
                            {linkedCase?.status ? <SmallBadge label={`Vaka durumu: ${mapCaseStatusLabel(linkedCase.status)}`} tone={getCaseStatusTone(linkedCase.status)} /> : null}
                            {hasCrmSignal ? <SmallBadge label={`CRM: ${mapCrmTagLabel(item.crmTag)}`} tone="info" /> : null}
                            {hasCrmSignal ? <SmallBadge label={`Risk: ${mapRiskLevelLabel(item.riskLevel)}`} tone={getRiskLevelTone(item.riskLevel)} /> : null}
                            {hasCrmSignal ? <SmallBadge label={`Takip: ${mapFollowupStatusLabel(item.followupStatus)}`} tone={getFollowupStatusTone(item.followupStatus)} /> : null}
                            {item.crmInternalNote ? <SmallBadge label="CRM notu var" tone="neutral" /> : null}
                            {responseState.reviewedAfterCustomer ? <SmallBadge label={`İnceleme: ${formatDate(item.operatorReviewedAt)}`} tone="info" /> : null}
                            {item.operatorNoteUpdatedAt ? <SmallBadge label={`Not: ${formatDate(item.operatorNoteUpdatedAt)}`} tone="neutral" /> : null}
                          </div>

                          {hasOperatorNote ? (
                            <div style={{ marginBottom: 10, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 10px', background: '#f9fafb', color: '#4b5563', fontSize: 13, lineHeight: 1.6 }}>
                              <strong>Operatör notu:</strong> {item.operatorNote}
                            </div>
                          ) : null}

                          {item.crmInternalNote ? (
                            <div style={{ marginBottom: 10, border: '1px solid #fde68a', borderRadius: 12, padding: '8px 10px', background: '#fffbeb', color: '#92400e', fontSize: 13, lineHeight: 1.6 }}>
                              <strong>CRM iç notu:</strong> {item.crmInternalNote}
                            </div>
                          ) : null}

                          {item.contextProductName ? (
                            <div style={{ display: 'inline-block', borderRadius: 999, padding: '6px 10px', background: '#f9fafb', color: '#4b5563', fontSize: 12, fontWeight: 700, border: '1px solid #e5e7eb' }}>
                              Aktif ürün bağlamı: {item.contextProductName}
                            </div>
                          ) : null}

                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                            <Link
                              href={`/inbox/${item.id}`}
                              style={{ textDecoration: 'none', color: '#111827', fontWeight: 800, fontSize: 13 }}
                            >
                              Konuşma Detayına Git →
                            </Link>
                            <CustomerProfileLink customerWaId={item.customerId} compact />
                          </div>
                        </div>

                        <div style={{ borderRadius: 16, padding: 14, ...recommendationBoxStyle }}>
                          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3, opacity: 0.85 }}>
                            Operatör için önerilen aksiyon
                          </div>

                          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, lineHeight: 1.4 }}>
                            {responseState.needsReply
                              ? 'Müşteriye yanıt ver veya incele'
                              : hasCriticalCrmSignal
                                ? 'CRM uyarısını dikkate al'
                                : linkedCase
                                  ? 'Bağlı operasyon vakası var'
                                  : operatorPriority === 'high'
                                    ? 'Yüksek öncelikli takip'
                                    : responseState.reviewedAfterCustomer
                                      ? 'İncelendi, takip gerekmiyor'
                                      : recommendation.title}
                          </div>

                          <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
                            {responseState.needsReply
                              ? 'Müşteriye AI cevap vermiş olabilir; operatör manuel yanıt vermediği veya incelemediği için bu konuşma hâlâ yanıt kuyruğunda.'
                              : hasCriticalCrmSignal
                                ? `Bu müşteri CRM tarafında ${mapCrmTagLabel(item.crmTag)} / ${mapRiskLevelLabel(item.riskLevel)} risk / ${mapFollowupStatusLabel(item.followupStatus)} olarak işaretli.`
                                : linkedCase
                                  ? `${linkedCase.caseNo || 'Operasyon vakası'} bu konuşmaya bağlı. Operasyonlar ekranından takip edilebilir.`
                                  : operatorPriority === 'high'
                                    ? 'Operatör bu konuşmayı yüksek öncelikli işaretledi. Not ve etiket detayını kontrol edin.'
                                    : responseState.reviewedAfterCustomer
                                      ? 'Operatör AI cevabını yeterli gördü. Müşteriye ek WhatsApp mesajı gönderilmeden kuyruktan düşürüldü.'
                                      : recommendation.helper}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <SmallBadge label={responseState.needsReply ? 'Yanıt kuyruğu' : hasCriticalCrmSignal ? 'CRM uyarısı' : linkedCase ? 'Operasyon bağlı' : operatorPriority === 'high' ? 'Yüksek öncelik' : responseState.reviewedAfterCustomer ? 'İncelendi' : recommendation.queueLabel} tone={responseState.needsReply ? 'danger' : hasCriticalCrmSignal ? 'danger' : linkedCase ? 'info' : operatorPriority === 'high' ? 'danger' : responseState.reviewedAfterCustomer ? 'info' : recommendation.tone} />
                            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{formatDate(item.lastMessageAt)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
