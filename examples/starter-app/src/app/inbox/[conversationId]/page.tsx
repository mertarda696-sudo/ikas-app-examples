'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .trim();
}

function inferFlowContext(conversation: ConversationDetailResponse['conversation']) {
  if (!conversation) {
    return {
      orderId: null as string | null,
      orderLabel: 'Henüz bağlanmadı',
      caseId: null as string | null,
      caseLabel: 'Henüz bağlanmadı',
      summary: 'Konuşma bağı henüz oluşturulmadı.',
    };
  }

  const allText = normalizeText(
    conversation.messages.map((message) => message.textBody || '').join(' '),
  );
  const product = normalizeText(conversation.contextProductName);

  if (allText.includes('dekont') || allText.includes('odeme')) {
    return {
      orderId: 'SIP-10387',
      orderLabel: 'Dekont / ödeme ile ilişkili sipariş',
      caseId: 'OP-303',
      caseLabel: 'Ödeme / Dekont vakası',
      summary: 'Bu konuşma finans ve dekont kontrolü gerektiren müşteri akışına benziyor.',
    };
  }

  if (allText.includes('kargo')) {
    return {
      orderId: 'SIP-10412',
      orderLabel: 'Kargo takibi olan sipariş',
      caseId: 'OP-302',
      caseLabel: 'Kargo şikayeti vakası',
      summary: 'Bu konuşma daha çok teslimat ve kargo akışıyla ilişkili görünüyor.',
    };
  }

  if (allText.includes('iade') || allText.includes('degisim') || allText.includes('beden')) {
    return {
      orderId: 'SIP-10374',
      orderLabel: 'İade / değişim ilişkili sipariş',
      caseId: 'OP-304',
      caseLabel: 'İade / Değişim vakası',
      summary: 'Bu konuşma değişim veya iade operasyonuna yakın görünüyor.',
    };
  }

  if (
    allText.includes('hasar') ||
    allText.includes('kusur') ||
    conversation.messages.some((message) => message.hasMediaLikePayload)
  ) {
    return {
      orderId: 'SIP-10428',
      orderLabel: 'Hasarlı ürün ilişkili sipariş',
      caseId: 'OP-301',
      caseLabel: 'Hasarlı Ürün vakası',
      summary: 'Bu konuşmada medya veya hasar sinyali olduğu için operasyon bağı önemli olabilir.',
    };
  }

  if (product) {
    return {
      orderId: 'SIP-10428',
      orderLabel: 'Ürün bağlamına yakın sipariş',
      caseId: null,
      caseLabel: 'Şu an açık vaka görünmüyor',
      summary: 'Konuşmada aktif ürün bağlamı var; sipariş ve ürün akışı birlikte düşünülmeli.',
    };
  }

  return {
    orderId: null,
    orderLabel: 'Henüz bağlanmadı',
    caseId: null,
    caseLabel: 'Henüz bağlanmadı',
    summary: 'Bu konuşma şu an genel yardım veya erken aşama müşteri akışı gibi görünüyor.',
  };
}

function inferOperatorDeskState(
  conversation: ConversationDetailResponse['conversation'],
  flowContext: ReturnType<typeof inferFlowContext>,
) {
  if (!conversation) {
    return {
      title: 'Konuşma bilgisi bekleniyor',
      helper: 'Henüz işlenebilir bir konuşma verisi görünmüyor.',
      tone: 'neutral' as const,
      attention: 'Belirsiz',
      recommendedStep: 'Önce konuşma kaydı doğrulanmalı.',
    };
  }

  const allText = normalizeText(
    conversation.messages.map((message) => message.textBody || '').join(' '),
  );
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const customerWaiting =
    String(conversation.status || '').toLowerCase() === 'open' &&
    lastMessage?.direction === 'in';

  if (allText.includes('dekont') || allText.includes('odeme')) {
    return {
      title: 'Önce ödeme / dekont akışını kontrol et',
      helper:
        'Bu konuşmada finans ve sipariş tarafı birlikte düşünülmeli. Müşteriye cevap vermeden önce sipariş ve operasyon kaydına bakmak doğru olur.',
      tone: 'warning' as const,
      attention: customerWaiting ? 'Müşteri bekliyor' : 'Finans öncelikli',
      recommendedStep:
        'Önce sipariş ve operasyon kaydını aç, sonra müşteriye kontrollü dönüş yap.',
    };
  }

  if (allText.includes('kargo')) {
    return {
      title: 'Sipariş ve kargo durumunu doğrula',
      helper:
        'Teslimat veya kargo akışı baskın görünüyor. Yanıt öncesi sipariş ekranında durum kontrolü faydalı olur.',
      tone: 'info' as const,
      attention: customerWaiting ? 'Müşteri bekliyor' : 'Takip gerekli',
      recommendedStep:
        'Önce sipariş ekranına bak, sonra müşteriye güncel durumla cevap ver.',
    };
  }

  if (flowContext.caseId) {
    return {
      title: 'Operasyon kaydını da birlikte yönet',
      helper:
        'Bu konuşma vaka üretmiş veya üretmeye yakın görünüyor. Reply ile birlikte operasyon ekranı da önemli.',
      tone: 'warning' as const,
      attention: customerWaiting ? 'Vaka + müşteri bekliyor' : 'Operasyon odaklı',
      recommendedStep:
        'Operasyon kaydını aç, gerekiyorsa ardından sipariş ve reply akışına dön.',
    };
  }

  if (conversation.contextProductName && customerWaiting) {
    return {
      title: 'Ürün bağlamını kullanarak hızlı dönüş yap',
      helper:
        'Aktif ürün bağlamı görünür olduğu için konuşma daha hızlı ve kontrollü cevaplanabilir.',
      tone: 'success' as const,
      attention: 'Ürün sorusu / müşteri bekliyor',
      recommendedStep:
        'Önce konuşma içinde ürün bağlamını doğrula, sonra müşteriye yanıt yaz.',
    };
  }

  if (customerWaiting) {
    return {
      title: 'Müşteriye geri dönüş yap',
      helper:
        'Bu konuşmada son top müşteride. Operatör ekranından doğrudan yanıt üretmek öncelikli olabilir.',
      tone: 'warning' as const,
      attention: 'Açık konuşma',
      recommendedStep: 'Reply alanına odaklan ve gerekirse sonra sipariş/operasyon akışına geç.',
    };
  }

  return {
    title: 'Genel takip modunda kal',
    helper:
      'Bu konuşma şu an kritik görünmüyor. Bağlı kayıtları gözden geçirip genel takipte kalınabilir.',
    tone: 'neutral' as const,
    attention: 'Rutin takip',
    recommendedStep: 'Konuşmayı, siparişi ve operasyon kaydını ihtiyaç halinde aç.',
  };
}

function toneStyles(tone: 'neutral' | 'success' | 'warning' | 'info') {
  if (tone === 'success') {
    return {
      border: '1px solid #bbf7d0',
      background: '#f0fdf4',
      color: '#166534',
    };
  }

  if (tone === 'warning') {
    return {
      border: '1px solid #fde68a',
      background: '#fffbeb',
      color: '#92400e',
    };
  }

  if (tone === 'info') {
    return {
      border: '1px solid #bfdbfe',
      background: '#eff6ff',
      color: '#1d4ed8',
    };
  }

  return {
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    color: '#374151',
  };
}

function InfoCard({
  title,
  value,
  helper,
  href,
  hrefLabel,
}: {
  title: string;
  value: string;
  helper: string;
  href: string;
  hrefLabel: string;
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
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ color: '#6b7280', lineHeight: 1.7, fontSize: 13, marginBottom: 12 }}>
        {helper}
      </div>
      <Link
        href={href}
        style={{
          textDecoration: 'none',
          display: 'inline-flex',
          borderRadius: 12,
          padding: '9px 13px',
          background: '#111827',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {hrefLabel}
      </Link>
    </div>
  );
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

  const conversation = data?.conversation || null;
  const badge = statusColors(conversation?.status);
  const flowContext = useMemo(() => inferFlowContext(conversation), [conversation]);
  const operatorDeskState = useMemo(
    () => inferOperatorDeskState(conversation, flowContext),
    [conversation, flowContext],
  );
  const operatorTone = toneStyles(operatorDeskState.tone);

  const hasWhatsAppLine = Boolean(data?.tenant?.waPhoneNumberId);
  const replyDisabledReason = hasWhatsAppLine
    ? null
    : 'Bu mağaza için WhatsApp hattı henüz bağlanmamış.';

  const handleSendReply = async () => {
    try {
      const normalizedReply = replyText.trim();

      setActionError(null);
      setActionSuccess(null);

      if (!conversationId) {
        setActionError('conversationId bulunamadı.');
        return;
      }

      if (!hasWhatsAppLine) {
        setActionError('Bu mağaza için WhatsApp hattı henüz bağlanmamış.');
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
          <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
            Bu ekran artık yalnız mesaj akışı değil, operatörün müşteriyi, siparişi ve
            operasyonu birlikte yönettiği çalışma yüzeyi gibi davranır.
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
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.95fr)',
                gap: 16,
              }}
            >
              <div
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
                      <div>
                        <strong>WhatsApp hattı:</strong>{' '}
                        {hasWhatsAppLine ? 'Bağlı' : 'Bağlı değil'}
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
              </div>

              <div
                style={{
                  borderRadius: 18,
                  padding: 18,
                  ...operatorTone,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.35,
                    opacity: 0.86,
                  }}
                >
                  Operatör için önerilen akış
                </div>

                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    marginBottom: 10,
                    lineHeight: 1.35,
                  }}
                >
                  {operatorDeskState.title}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    marginBottom: 12,
                  }}
                >
                  {operatorDeskState.helper}
                </div>

                <div
                  style={{
                    borderTop: '1px solid rgba(0,0,0,0.08)',
                    paddingTop: 12,
                    fontSize: 13,
                    lineHeight: 1.7,
                    marginBottom: 12,
                  }}
                >
                  <strong>Dikkat seviyesi:</strong> {operatorDeskState.attention}
                  <br />
                  <strong>Önerilen sıradaki adım:</strong> {operatorDeskState.recommendedStep}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link
                    href={flowContext.orderId ? `/orders/${flowContext.orderId}` : '/orders'}
                    style={{
                      textDecoration: 'none',
                      display: 'inline-flex',
                      borderRadius: 12,
                      padding: '9px 13px',
                      background: '#111827',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Siparişe Git
                  </Link>

                  <Link
                    href={flowContext.caseId ? `/operations/${flowContext.caseId}` : '/operations'}
                    style={{
                      textDecoration: 'none',
                      display: 'inline-flex',
                      borderRadius: 12,
                      padding: '9px 13px',
                      background: '#ffffff',
                      color: '#111827',
                      fontWeight: 700,
                      fontSize: 14,
                      border: '1px solid #d1d5db',
                    }}
                  >
                    Operasyona Git
                  </Link>
                </div>
              </div>
            </section>

            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12,
              }}
            >
              <InfoCard
                title="Bağlı Sipariş"
                value={flowContext.orderLabel}
                helper={
                  flowContext.orderId
                    ? `Önerilen sipariş: ${flowContext.orderId}`
                    : 'Bu konuşma için net sipariş bağı henüz görünmüyor.'
                }
                href={flowContext.orderId ? `/orders/${flowContext.orderId}` : '/orders'}
                hrefLabel={flowContext.orderId ? 'Siparişe Git' : 'Siparişleri Aç'}
              />

              <InfoCard
                title="Bağlı Operasyon"
                value={flowContext.caseLabel}
                helper={
                  flowContext.caseId
                    ? `Önerilen vaka: ${flowContext.caseId}`
                    : 'Bu konuşma şu an doğrudan vaka üretmemiş olabilir.'
                }
                href={flowContext.caseId ? `/operations/${flowContext.caseId}` : '/operations'}
                hrefLabel={flowContext.caseId ? 'Vakaya Git' : 'Operasyonları Aç'}
              />

              <InfoCard
                title="Müşteri Olay Özeti"
                value="Özet"
                helper={flowContext.summary}
                href="/catalog"
                hrefLabel="Kataloğu Aç"
              />
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
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                Operatör Mesajı
              </div>

              <div style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 12 }}>
                {hasWhatsAppLine
                  ? 'Bu alandan müşteriye manuel WhatsApp mesajı gönderebilirsin. Kayıtlar arası geçiş butonları reply akışıyla birlikte kullanıma açık tutuldu.'
                  : 'Bu mağaza için WhatsApp hattı henüz bağlanmadığı için manuel gönderim şu anda kapalı. Hat bağlandığında bu alan canlı reply için kullanılacak.'}
              </div>

              {!hasWhatsAppLine ? (
                <div
                  style={{
                    marginBottom: 12,
                    border: '1px solid #fde68a',
                    background: '#fffbeb',
                    color: '#92400e',
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {replyDisabledReason}
                </div>
              ) : null}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 320px)',
                  gap: 14,
                  alignItems: 'start',
                }}
              >
                <div>
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder={
                      hasWhatsAppLine
                        ? 'Müşteriye gönderilecek manuel mesajı yazın...'
                        : 'WhatsApp hattı bağlanmadan manuel gönderim açılamaz.'
                    }
                    style={{
                      width: '100%',
                      minHeight: 140,
                      borderRadius: 14,
                      border: '1px solid #d1d5db',
                      padding: 14,
                      fontSize: 14,
                      lineHeight: 1.6,
                      resize: 'vertical',
                      outline: 'none',
                      background: hasWhatsAppLine ? '#ffffff' : '#f9fafb',
                    }}
                    disabled={sending || !hasWhatsAppLine}
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
                      {hasWhatsAppLine
                        ? `${replyText.trim().length} karakter`
                        : 'WhatsApp hattı bekleniyor'}
                    </div>

                    <button
                      onClick={handleSendReply}
                      disabled={sending || !hasWhatsAppLine}
                      style={{
                        border: 'none',
                        borderRadius: 12,
                        padding: '10px 16px',
                        background: sending || !hasWhatsAppLine ? '#9ca3af' : '#111827',
                        color: '#ffffff',
                        fontWeight: 700,
                        cursor: sending || !hasWhatsAppLine ? 'not-allowed' : 'pointer',
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
                </div>

                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    background: '#f9fafb',
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#6b7280',
                      marginBottom: 10,
                      textTransform: 'uppercase',
                      letterSpacing: 0.3,
                    }}
                  >
                    Kayıtlar arası geçiş
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    <Link
                      href={flowContext.orderId ? `/orders/${flowContext.orderId}` : '/orders'}
                      style={{
                        textDecoration: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: '10px 14px',
                        background: '#ffffff',
                        color: '#111827',
                        fontWeight: 700,
                      }}
                    >
                      Siparişe Git
                    </Link>

                    <Link
                      href={flowContext.caseId ? `/operations/${flowContext.caseId}` : '/operations'}
                      style={{
                        textDecoration: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: '10px 14px',
                        background: '#ffffff',
                        color: '#111827',
                        fontWeight: 700,
                      }}
                    >
                      Operasyona Git
                    </Link>

                    <Link
                      href="/catalog"
                      style={{
                        textDecoration: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: '10px 14px',
                        background: '#ffffff',
                        color: '#111827',
                        fontWeight: 700,
                      }}
                    >
                      Kataloğa Git
                    </Link>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      color: '#6b7280',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    Reply öncesi veya sonrası ilgili sipariş ve operasyon kaydına geçmek için
                    bu alanı kullanabilirsin.
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}
      </main>
    </AppShell>
  );
}
