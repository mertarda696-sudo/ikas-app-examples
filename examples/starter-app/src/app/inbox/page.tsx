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
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            Mesajlar
          </h1>
          <p style={{ color: '#4b5563', margin: 0 }}>
            WhatsApp konuşmaları ve konuşma detay ekranı burada listelenecek.
          </p>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div
            style={{
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 12,
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
            Bu tenant için henüz konuşma görünmüyor. WhatsApp bağlı değilse bu ekranın boş gelmesi normaldir.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/inbox/${item.id}`}
                style={{
                  textDecoration: 'none',
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  background: '#ffffff',
                  padding: 16,
                  color: '#111827',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 280, flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                      {item.customerDisplay}
                    </div>

                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                      {mapChannelLabel(item.channel)} · {item.isOpen ? 'Açık konuşma' : 'Kapalı konuşma'}
                    </div>

                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                      <strong>{mapDirectionLabel(item.lastMessageDirection)}:</strong>{' '}
                      {item.lastMessageText || 'Mesaj metni bulunmuyor.'}
                    </div>

                    {item.contextProductName ? (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                        Aktif ürün bağlamı: {item.contextProductName}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ minWidth: 180, textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                      Son mesaj zamanı
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {formatDate(item.lastMessageAt)}
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: 'inline-block',
                        borderRadius: 999,
                        padding: '6px 10px',
                        background: item.isOpen ? '#ecfdf5' : '#f3f4f6',
                        color: item.isOpen ? '#065f46' : '#4b5563',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {item.status || '-'}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
