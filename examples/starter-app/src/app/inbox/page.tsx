'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { InboxListResponse } from '@/lib/apparel-panel/types';
import {
  inferLinkedCaseId,
  inferLinkedOrderId,
  inferPriorityLabel,
  getConversationQueueHint,
} from '@/lib/apparel-panel/panel-relations';

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

        const response = await fetch('/api/apparel/inbox', {
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
          items: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const items = useMemo(() => data?.items || [], [data?.items]);
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const ar = getResponseState(a).needsReply ? 1 : 0;
        const br = getResponseState(b).needsReply ? 1 : 0;
        if (ar !== br) return br - ar;
        const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bt - at;
      }),
    [items],
  );

  const metrics = useMemo(() => {
    const openCount = items.filter((item) => String(item.status).toLowerCase() === 'open').length;
    const closedCount = items.filter((item) => String(item.status).toLowerCase() === 'closed').length;
    const productContextCount = items.filter((item) => item.contextProductName).length;
    const waitingReplyCount = items.filter((item) => getResponseState(item).needsReply).length;

    return { openCount, closedCount, productContextCount, waitingReplyCount };
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
              <MetricCard label="Kapalı Konuşma" value={metrics.closedCount} helper="Kapanmış kayıtlar" />
            </section>

            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Operatör Konuşma Kuyruğu</div>

              <div style={{ display: 'grid', gap: 14 }}>
                {sortedItems.map((item) => {
                  const linkedOrderId = inferLinkedOrderId(item.lastMessageText, item.contextProductName);
                  const linkedCaseId = inferLinkedCaseId(item.lastMessageText);
                  const priorityLabel = inferPriorityLabel(item.lastMessageText);
                  const recommendation = getConversationQueueHint(item);
                  const responseState = getResponseState(item);

                  const recommendationBoxStyle =
                    responseState.needsReply
                      ? { border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }
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
                    <Link
                      key={item.id}
                      href={`/inbox/${item.id}`}
                      style={{ textDecoration: 'none', border: responseState.needsReply ? '1px solid #fecaca' : '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18, color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.95fr)', gap: 16, alignItems: 'stretch' }}>
                        <div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                            <div style={{ fontSize: 17, fontWeight: 800 }}>{item.customerDisplay}</div>
                            <SmallBadge label={mapChannelLabel(item.channel)} tone="info" />
                            <SmallBadge label={mapStatusLabel(item.status)} tone={getStatusTone(item.status)} />
                            <SmallBadge label={responseState.label} tone={responseState.tone} />
                          </div>

                          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>
                            <strong>{mapSenderLabel(item.lastMessageSenderType, item.lastMessageDirection)}:</strong>{' '}
                            {item.lastMessageText || 'Mesaj metni bulunmuyor.'}
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                            <SmallBadge label={priorityLabel} tone="warning" />
                            <SmallBadge label={linkedOrderId ? `Bağlı sipariş: ${linkedOrderId}` : 'Sipariş bağı henüz yok'} tone={linkedOrderId ? 'info' : 'neutral'} />
                            <SmallBadge label={linkedCaseId ? `Bağlı vaka: ${linkedCaseId}` : 'Vaka bağı henüz yok'} tone={linkedCaseId ? 'info' : 'neutral'} />
                            {responseState.reviewedAfterCustomer ? <SmallBadge label={`İnceleme: ${formatDate(item.operatorReviewedAt)}`} tone="info" /> : null}
                          </div>

                          {item.contextProductName ? (
                            <div style={{ display: 'inline-block', borderRadius: 999, padding: '6px 10px', background: '#f9fafb', color: '#4b5563', fontSize: 12, fontWeight: 700, border: '1px solid #e5e7eb' }}>
                              Aktif ürün bağlamı: {item.contextProductName}
                            </div>
                          ) : null}
                        </div>

                        <div style={{ borderRadius: 16, padding: 14, ...recommendationBoxStyle }}>
                          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3, opacity: 0.85 }}>
                            Operatör için önerilen aksiyon
                          </div>

                          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, lineHeight: 1.4 }}>
                            {responseState.needsReply ? 'Müşteriye yanıt ver veya incele' : responseState.reviewedAfterCustomer ? 'İncelendi, takip gerekmiyor' : recommendation.title}
                          </div>

                          <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
                            {responseState.needsReply
                              ? 'Müşteriye AI cevap vermiş olabilir; operatör manuel yanıt vermediği veya incelemediği için bu konuşma hâlâ yanıt kuyruğunda.'
                              : responseState.reviewedAfterCustomer
                                ? 'Operatör AI cevabını yeterli gördü. Müşteriye ek WhatsApp mesajı gönderilmeden kuyruktan düşürüldü.'
                                : recommendation.helper}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <SmallBadge label={responseState.needsReply ? 'Yanıt kuyruğu' : responseState.reviewedAfterCustomer ? 'İncelendi' : recommendation.queueLabel} tone={responseState.needsReply ? 'danger' : responseState.reviewedAfterCustomer ? 'info' : recommendation.tone} />
                            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{formatDate(item.lastMessageAt)}</div>
                          </div>
                        </div>
                      </div>
                    </Link>
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
