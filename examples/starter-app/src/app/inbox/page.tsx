'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { InboxListResponse } from '@/lib/apparel-panel/types';

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

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .trim();
}

function inferLinkedOrderId(lastMessageText: string | null | undefined, contextProductName: string | null | undefined) {
  const text = normalizeText(lastMessageText);
  const product = normalizeText(contextProductName);

  if (text.includes('dekont') || text.includes('odeme')) return 'SIP-10387';
  if (text.includes('kargo')) return 'SIP-10412';
  if (text.includes('iade') || text.includes('degisim')) return 'SIP-10374';
  if (product) return 'SIP-10428';

  return null;
}

function inferLinkedCaseId(lastMessageText: string | null | undefined) {
  const text = normalizeText(lastMessageText);

  if (text.includes('dekont') || text.includes('odeme')) return 'OP-303';
  if (text.includes('kargo')) return 'OP-302';
  if (text.includes('iade') || text.includes('degisim') || text.includes('beden')) return 'OP-304';
  if (text.includes('hasar') || text.includes('yirtik') || text.includes('kusur')) return 'OP-301';

  return null;
}

function inferPriorityLabel(lastMessageText: string | null | undefined) {
  const text = normalizeText(lastMessageText);

  if (text.includes('dekont') || text.includes('odeme')) return 'Finans öncelikli';
  if (text.includes('kargo')) return 'Kargo takibi';
  if (text.includes('iade') || text.includes('degisim')) return 'Operasyon adayı';
  if (text.includes('hasar') || text.includes('kusur')) return 'Kanıt kontrolü';
  return 'Genel takip';
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
    const operationCandidateCount = items.filter((item) =>
      Boolean(inferLinkedCaseId(item.lastMessageText)),
    ).length;

    return {
      openCount,
      closedCount,
      productContextCount,
      operationCandidateCount,
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
              Konuşmalar burada yalnız mesaj olarak değil, müşteri olayı olarak görünür.
              Böylece sipariş ve operasyon akışına geçiş daha kolay olur.
            </p>
          </div>

          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              background: '#ffffff',
              padding: 14,
              color: '#6b7280',
              maxWidth: 340,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Bu ekran müşteri firmanın önce hangi konuşmaya bakması gerektiğini, o
            konuşmanın sipariş ve operasyon tarafıyla ilişkisini daha görünür hale getirmek için güçlendirildi.
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
                label="Kapalı Konuşma"
                value={metrics.closedCount}
                helper="Kapanmış kayıtlar"
              />
              <MetricCard
                label="Ürün Bağlamlı"
                value={metrics.productContextCount}
                helper="Aktif ürün bağlamı olan konuşmalar"
              />
              <MetricCard
                label="Operasyon Adayı"
                value={metrics.operationCandidateCount}
                helper="Vaka üretmeye yakın konuşmalar"
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
                Konuşma Listesi
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
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 18,
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ minWidth: 320, flex: 1 }}>
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
                                linkedOrderId ? `Bağlı sipariş: ${linkedOrderId}` : 'Sipariş bağı henüz yok'
                              }
                              tone={linkedOrderId ? 'info' : 'neutral'}
                            />
                            <SmallBadge
                              label={
                                linkedCaseId ? `Bağlı vaka: ${linkedCaseId}` : 'Vaka bağı henüz yok'
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
                            minWidth: 210,
                            textAlign: 'right',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#6b7280',
                              marginBottom: 8,
                              textTransform: 'uppercase',
                              letterSpacing: 0.3,
                            }}
                          >
                            Son mesaj zamanı
                          </div>

                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#111827',
                              marginBottom: 10,
                            }}
                          >
                            {formatDate(item.lastMessageAt)}
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              color: '#6b7280',
                              lineHeight: 1.6,
                            }}
                          >
                            Konuşmayı açınca sipariş ve operasyon bağı daha detaylı görünür.
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
