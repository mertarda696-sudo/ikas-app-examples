'use client';

import Link from 'next/link';
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

function mapChannelLabel(channel: string | null | undefined) {
  const normalized = String(channel || '').toLowerCase();

  if (normalized === 'whatsapp') return 'WhatsApp';
  if (normalized === 'instagram') return 'Instagram';
  if (normalized === 'email') return 'E-posta';

  return channel || 'Kanal';
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

export default function ConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = Array.isArray(params?.conversationId)
    ? params?.conversationId[0]
    : params?.conversationId;

  const [data, setData] = useState<ConversationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadConversation = async (options?: { silent?: boolean }) => {
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

      if (!options?.silent) {
        setLoading(true);
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
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  const handleSendReply = async () => {
    try {
      const normalizedReply = replyText.trim();

      setActionError(null);
      setActionSuccess(null);

      if (!conversationId) {
        setActionError('conversationId bulunamadı.');
        return;
      }

      if (!normalizedReply) {
        setActionError('Lütfen gönderilecek mesajı yazın.');
        return;
      }

      setSending(true);

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setActionError('iFrame JWT token alınamadı.');
        return;
      }

      const response = await fetch(
        `/api/apparel/conversations/${conversationId}/reply`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Authorization: 'JWT ' + iframeToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            replyText: normalizedReply,
          }),
        },
      );

      const raw = await response.json();

      if (!response.ok || !raw?.ok) {
        throw new Error(raw?.error || 'Mesaj gönderilemedi.');
      }

      setReplyText('');
      setActionSuccess('Mesaj başarıyla gönderildi.');

      await loadConversation({ silent: true });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Mesaj gönderilirken hata oluştu.',
      );
    } finally {
      setSending(false);
    }
  };

  const conversation = data?.conversation || null;
  const badge = statusColors(conversation?.status);

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
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/inbox"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              borderRadius: 10,
              padding: '8px 12px',
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            ← Mesajlara dön
          </Link>

          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            Konuşma Detayı
          </h1>
          <p style={{ color: '#4b5563', margin: 0 }}>
            Mesaj akışı, ürün bağlamı ve medya / kanıt görünümü burada yer alır.
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
                borderRadius: 18,
                padding: 18,
                background: '#ffffff',
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
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: '#111827',
                      marginBottom: 8,
                    }}
                  >
                    {conversation.customerDisplay}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginBottom: 10,
                    }}
                  >
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
                      {mapChannelLabel(conversation.channel)}
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
                      {mapStatusLabel(conversation.status)}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 6, color: '#4b5563' }}>
                    <div>
                      <strong>Müşteri kimliği:</strong> {conversation.customerId || '-'}
                    </div>
                    <div>
                      <strong>Aktif ürün bağlamı:</strong>{' '}
                      {conversation.contextProductName || '-'}
                    </div>
                  </div>
                </div>

                <div style={{ minWidth: 220, textAlign: 'right' }}>
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    {formatDate(conversation.lastMessageAt)}
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 13,
                      color: '#6b7280',
                    }}
                  >
                    Toplam mesaj: {conversation.messages.length}
                  </div>
                </div>
              </div>
            </section>

            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
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
                            maxWidth: '78%',
                            borderRadius: 18,
                            padding: 14,
                            background: incoming ? '#ffffff' : '#111827',
                            color: incoming ? '#111827' : '#ffffff',
                            border: incoming ? '1px solid #e5e7eb' : '1px solid #111827',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              opacity: 0.82,
                              marginBottom: 6,
                            }}
                          >
                            {mapDirectionLabel(message.direction)} ·{' '}
                            {mapMsgTypeLabel(message.msgType)}
                          </div>

                          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
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
                                fontWeight: 800,
                                opacity: 0.9,
                              }}
                            >
                              Medya / kanıt içeriği mevcut olabilir
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
                borderRadius: 18,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
                Operatör Mesajı
              </div>

              <div style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 12 }}>
                Bu alandan müşteriye manuel WhatsApp mesajı gönderebilirsin.
              </div>

              <textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Müşteriye gönderilecek manuel mesajı yazın..."
                style={{
                  width: '100%',
                  minHeight: 120,
                  borderRadius: 14,
                  border: '1px solid #d1d5db',
                  padding: 14,
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none',
                }}
                disabled={sending}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginTop: 12,
                }}
              >
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {replyText.trim().length} karakter
                </div>

                <button
                  onClick={handleSendReply}
                  disabled={sending}
                  style={{
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 16px',
                    background: sending ? '#9ca3af' : '#111827',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: sending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {sending ? 'Gönderiliyor...' : 'Mesajı Gönder'}
                </button>
              </div>

              {actionError ? (
                <div
                  style={{
                    marginTop: 12,
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#991b1b',
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {actionError}
                </div>
              ) : null}

              {actionSuccess ? (
                <div
                  style={{
                    marginTop: 12,
                    border: '1px solid #bbf7d0',
                    background: '#f0fdf4',
                    color: '#166534',
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {actionSuccess}
                </div>
              ) : null}
            </section>

            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
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
