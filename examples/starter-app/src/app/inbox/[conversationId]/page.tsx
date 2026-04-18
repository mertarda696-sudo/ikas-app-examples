'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { ConversationDetailResponse } from '@/lib/apparel-panel/types';

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function mapDirectionLabel(direction: 'in' | 'out' | null | undefined) {
  if (direction === 'in') return 'Müşteri';
  if (direction === 'out') return 'Sistem / Operatör';
  return 'Bilinmiyor';
}

function mapMsgTypeLabel(msgType: string | null | undefined) {
  if (!msgType) return 'bilinmiyor';
  if (msgType === 'text') return 'metin';
  if (msgType === 'image') return 'görsel';
  if (msgType === 'video') return 'video';
  if (msgType === 'audio') return 'ses';
  if (msgType === 'document') return 'doküman';
  return msgType;
}

export default function ConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = Array.isArray(params?.conversationId)
    ? params?.conversationId[0]
    : params?.conversationId;

  const [data, setData] = useState<ConversationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        if (!conversationId) {
          setData({
            ok: false,
            fetchedAt: new Date().toISOString(),
            tenant: null,
            conversation: null,
            error: 'conversationId bulunamadı.',
          });
          return;
        }

        const iframeToken = await TokenHelpers.getTokenForIframeApp();

        if (!iframeToken) {
          setData({
            ok: false,
            fetchedAt: new Date().toISOString(),
            tenant: null,
            conversation: null,
            error: 'iFrame JWT token alınamadı.',
          });
          return;
        }

        const response = await fetch(`/api/apparel/conversations/${conversationId}`, {
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
          conversation: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [conversationId]);

  const conversation = data?.conversation || null;

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
            Konuşma Detayı
          </h1>
          <p style={{ color: '#4b5563', margin: 0 }}>
            Mesaj akışı, ürün bağlamı ve medya/kanıt görünümü burada yer alır.
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
        ) : !conversation ? (
          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              padding: 20,
              background: '#ffffff',
              color: '#6b7280',
            }}
          >
            Konuşma bulunamadı.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                Konuşma Özeti
              </div>

              <div style={{ display: 'grid', gap: 8, color: '#374151' }}>
                <div><strong>Müşteri:</strong> {conversation.customerDisplay}</div>
                <div><strong>Kanal:</strong> {conversation.channel || '-'}</div>
                <div><strong>Durum:</strong> {conversation.status || '-'}</div>
                <div><strong>Son mesaj:</strong> {formatDate(conversation.lastMessageAt)}</div>
                <div>
                  <strong>Aktif ürün bağlamı:</strong> {conversation.contextProductName || '-'}
                </div>
              </div>
            </section>

            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
                Mesaj Akışı
              </div>

              {conversation.messages.length === 0 ? (
                <div style={{ color: '#6b7280' }}>Bu konuşmada henüz mesaj görünmüyor.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {conversation.messages.map((message) => {
                    const incoming = message.direction === 'in';

                    return (
                      <div
                        key={message.id}
                        style={{
                          display: 'flex',
                          justifyContent: incoming ? 'flex-start' : 'flex-end',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '75%',
                            borderRadius: 16,
                            padding: 14,
                            background: incoming ? '#ffffff' : '#111827',
                            color: incoming ? '#111827' : '#ffffff',
                            border: incoming ? '1px solid #e5e7eb' : '1px solid #111827',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              opacity: 0.8,
                              marginBottom: 6,
                            }}
                          >
                            {mapDirectionLabel(message.direction)} · {mapMsgTypeLabel(message.msgType)}
                          </div>

                          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                            {message.textBody || 'Metin içeriği bulunmuyor.'}
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              opacity: 0.75,
                            }}
                          >
                            {formatDate(message.createdAt)}
                          </div>

                          {message.hasMediaLikePayload ? (
                            <div
                              style={{
                                marginTop: 10,
                                fontSize: 12,
                                fontWeight: 700,
                                opacity: 0.85,
                              }}
                            >
                              Medya / kanıt içeriği mevcut olabilir.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                Medya ve Kanıt Alanı
              </div>
              <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
                Hasarlı ürün fotoğrafı, video, sesli mesaj, PDF ve diğer müşteri medya
                kayıtları ilerleyen fazda bu alan üzerinden daha detaylı gösterilecek.
              </div>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
