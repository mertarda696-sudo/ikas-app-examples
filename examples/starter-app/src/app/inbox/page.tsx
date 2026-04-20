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

function mapDirectionLabel(direction: 'in' | 'out' | null | undefined) {
  if (direction === 'in') return 'Müşteri';
  if (direction === 'out') return 'Sistem / Operatör';
  return 'Bilinmiyor';
}

function mapStatusLabel(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'open') return 'Açık';
  if (normalized === 'closed') return 'Kapalı';
  return status || '-';
}

function statusColors(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'open') {
    return {
      background: '#ecfdf5',
      color: '#065f46',
    };
  }

  if (normalized === 'closed') {
    return {
      background: '#f3f4f6',
      color: '#4b5563',
    };
  }

  return {
    background: '#eff6ff',
    color: '#1d4ed8',
  };
}

function SmallBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'info';
}) {
  const styles =
    tone === 'success'
      ? { background: '#ecfdf5', color: '#065f46' }
      : tone === 'warning'
        ? { background: '#fffbeb', color: '#92400e' }
        : tone === 'info'
          ? { background: '#eff6ff', color: '#1d4ed8' }
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
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
        {helper}
      </div>
    </div>
  );
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
          headers: {
            Authorization: 'JWT ' + iframeToken,
          },
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

  const metrics = useMemo(() => {
    const openCount = items.filter((item) => String(item.status).toLowerCase() === 'open').length;
    const closedCount = items.filter((item) => String(item.status).toLowerCase() === 'closed').length;
    const productContextCount = items.filter((item) => item.contextProductName).length;
    const customerWaitingCount = items.filter(
      (item) =>
        String(item.status).toLowerCase() === 'open' &&
        item.lastMessageDirection === 'in',
    ).length;

    return {
      openCount,
      closedCount,
      productContextCount,
      customerWaitingCount,
    };
  }, [items]);

  return (
    <AppShell>
      <main
        style={{
          maxWidth: 1200,
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
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
              Mesajlar
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Bu ekran konuşmaları yalnız mesaj listesi gibi değil, operatörün önceliklendireceği
              müşteri olay kuyruğu gibi gösterir.
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
            Bu sürümde konuşma → sipariş → vaka ilişkileri ortak relation katmanından
            okunur. Aynı ilişki mantığı artık ekranlar arasında dağınık değildir.
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
              fontWeight: 600,
            }}
          >
            {data.error}
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              padding: 20,
              background: '#ffffff',
              color: '#6b7280',
            }}
          >
            Bu tenant için henüz konuşma görünmüyor. WhatsApp bağlı değilse bu ekranın boş
            gelmesi normaldir.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <MetricCard
                label="Açık Konuşma"
                value={metrics.openCount}
                helper="Aktif müşteri konuşmaları"
              />
              <MetricCard
                label="Müşteri Dönüşü Bekleyen"
                value={metrics.customerWaitingCount}
                helper="Son mesajı müşteriden gelen açık konuşmalar"
              />
              <MetricCard
                label="Ürün Bağlamlı"
                value={metrics.productContextCount}
                helper="Aktif ürün bağlamı olan konuşmalar"
              />
              <MetricCard
                label="Kapalı Konuşma"
                value={metrics.closedCount}
                helper="Kapanmış kayıtlar"
              />
            </section>

            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                background: '#ffffff',
                padding: 18,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                Operatör Konuşma Kuyruğu
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                {items.map((item) => {
                  const badge = statusColors(item.status);
                  const linkedOrderId = inferLinkedOrderId(
                    item.lastMessageText,
                    item.contextProductName,
                  );
                  const linkedCaseId = inferLinkedCaseId(item.lastMessageText);
                  const priorityLabel = inferPriorityLabel(item.lastMessageText);
                  const recommendation = getConversationQueueHint(item);

                  const recommendationBoxStyle =
                    recommendation.tone === 'success'
                      ? {
                          border: '1px solid #bbf7d0',
                          background: '#f0fdf4',
                          color: '#166534',
                        }
                      : recommendation.tone === 'warning'
                        ? {
                            border: '1px solid #fde68a',
                            background: '#fffbeb',
                            color: '#92400e',
                          }
                        : recommendation.tone === 'info'
                          ? {
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                            }
                          : {
                              border: '1px solid #e5e7eb',
                              background: '#f9fafb',
                              color: '#374151',
                            };

                  return (
                    <Link
                      key={item.id}
                      href={`/inbox/${item.id}`}
                      style={{
                        textDecoration: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: 18,
                        background: '#ffffff',
                        padding: 18,
                        color: '#111827',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.95fr)',
                          gap: 16,
                          alignItems: 'stretch',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              marginBottom: 10,
                            }}
                          >
                            <div style={{ fontSize: 17, fontWeight: 800 }}>
                              {item.customerDisplay}
                            </div>

                            <div
                              style={{
                                borderRadius: 999,
                                padding: '5px 10px',
                                background: '#eef2ff',
                                color: '#3730a3',
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {mapChannelLabel(item.channel)}
                            </div>

                            <div
                              style={{
                                borderRadius: 999,
                                padding: '5px 10px',
                                background: badge.background,
                                color: badge.color,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {mapStatusLabel(item.status)}
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: 14,
                              color: '#374151',
                              lineHeight: 1.7,
                              marginBottom: 10,
                            }}
                          >
                            <strong>{mapDirectionLabel(item.lastMessageDirection)}:</strong>{' '}
                            {item.lastMessageText || 'Mesaj metni bulunmuyor.'}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginBottom: 10,
                            }}
                          >
                            <SmallBadge label={priorityLabel} tone="warning" />
                            <SmallBadge
                              label={
                                linkedOrderId
                                  ? `Bağlı sipariş: ${linkedOrderId}`
                                  : 'Sipariş bağı henüz yok'
                              }
                              tone={linkedOrderId ? 'info' : 'neutral'}
                            />
                            <SmallBadge
                              label={
                                linkedCaseId
                                  ? `Bağlı vaka: ${linkedCaseId}`
                                  : 'Vaka bağı henüz yok'
                              }
                              tone={linkedCaseId ? 'info' : 'neutral'}
                            />
                          </div>

                          {item.contextProductName ? (
                            <div
                              style={{
                                display: 'inline-block',
                                borderRadius: 999,
                                padding: '6px 10px',
                                background: '#f9fafb',
                                color: '#4b5563',
                                fontSize: 12,
                                fontWeight: 700,
                                border: '1px solid #e5e7eb',
                              }}
                            >
                              Aktif ürün bağlamı: {item.contextProductName}
                            </div>
                          ) : null}
                        </div>

                        <div
                          style={{
                            borderRadius: 16,
                            padding: 14,
                            ...recommendationBoxStyle,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              marginBottom: 8,
                              textTransform: 'uppercase',
                              letterSpacing: 0.3,
                              opacity: 0.85,
                            }}
                          >
                            Operatör için önerilen aksiyon
                          </div>

                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              marginBottom: 8,
                              lineHeight: 1.4,
                            }}
                          >
                            {recommendation.title}
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.7,
                              marginBottom: 12,
                            }}
                          >
                            {recommendation.helper}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 12,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <SmallBadge
                              label={recommendation.queueLabel}
                              tone={recommendation.tone}
                            />

                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                opacity: 0.85,
                              }}
                            >
                              {formatDate(item.lastMessageAt)}
                            </div>
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
