'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { ConversationDetailResponse } from '@/lib/apparel-panel/types';
import {
  getConversationDeskState,
  getConversationFlowContext,
} from '@/lib/apparel-panel/panel-relations';

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

function Badge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }) {
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
    <span style={{ display: 'inline-flex', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700, ...styles }}>
      {label}
    </span>
  );
}

function toneStyles(tone: 'neutral' | 'success' | 'warning' | 'info') {
  if (tone === 'success') return { border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534' };
  if (tone === 'warning') return { border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e' };
  if (tone === 'info') return { border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8' };
  return { border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151' };
}

function getResponseState(conversation: ConversationDetailResponse['conversation']) {
  const isOpen = String(conversation?.status || '').toLowerCase() === 'open';
  const lastMessage = conversation?.messages?.[conversation.messages.length - 1] || null;
  const needsReply = isOpen && lastMessage?.direction === 'in';

  return {
    needsReply,
    label: needsReply ? 'Yanıt bekliyor' : 'Cevaplandı',
    tone: needsReply ? ('danger' as const) : ('success' as const),
  };
}

function quickReplySuggestions(contextProductName?: string | null) {
  const productPart = contextProductName ? `${contextProductName} için ` : '';
  return [
    `${productPart}size yardımcı olurum. Hangi konuda bilgi almak istersiniz?`,
    'Dilerseniz ürün adı, beden veya renk bilgisini yazın; hemen kontrol edelim.',
    'Siparişinizle ilgili işlem yapabilmem için sipariş numaranızı paylaşabilir misiniz?',
  ];
}

export default function ConversationDetailPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = Array.isArray(params?.conversationId) ? params?.conversationId[0] : params?.conversationId;

  const [data, setData] = useState<ConversationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadConversation = async (options?: { silent?: boolean }) => {
    try {
      if (!conversationId) {
        setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, conversation: null, error: 'conversationId bulunamadı.' });
        return;
      }

      if (!options?.silent) setLoading(true);
      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, conversation: null, error: 'iFrame JWT token alınamadı.' });
        return;
      }

      const response = await fetch(`/api/apparel/conversations/${conversationId}`, {
        cache: 'no-store',
        headers: { Authorization: 'JWT ' + iframeToken },
      });

      const raw = await response.json();
      setData(raw);
    } catch (error) {
      setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, conversation: null, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  const conversation = data?.conversation || null;
  const flowContext = useMemo(() => getConversationFlowContext(conversation), [conversation]);
  const operatorDeskState = useMemo(() => getConversationDeskState(conversation, flowContext), [conversation, flowContext]);
  const operatorTone = toneStyles(operatorDeskState.tone);
  const responseState = getResponseState(conversation);
  const suggestions = quickReplySuggestions(conversation?.contextProductName);
  const hasWhatsAppLine = Boolean(data?.tenant?.waPhoneNumberId);

  const handleSendReply = async () => {
    try {
      const normalizedReply = replyText.trim();
      setActionError(null);
      setActionSuccess(null);

      if (!conversationId) return setActionError('conversationId bulunamadı.');
      if (!hasWhatsAppLine) return setActionError('Bu mağaza için WhatsApp hattı henüz bağlanmamış.');
      if (!normalizedReply) return setActionError('Lütfen gönderilecek mesajı yazın.');

      setSending(true);
      const iframeToken = await TokenHelpers.getTokenForIframeApp();
      if (!iframeToken) return setActionError('iFrame JWT token alınamadı.');

      const response = await fetch(`/api/apparel/conversations/${conversationId}/reply`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ replyText: normalizedReply }),
      });

      const raw = await response.json();
      if (!response.ok || !raw?.ok) throw new Error(raw?.error || 'Mesaj gönderilemedi.');

      setReplyText('');
      setActionSuccess('Mesaj başarıyla gönderildi.');
      await loadConversation({ silent: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Mesaj gönderilirken hata oluştu.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell>
      <main style={{ maxWidth: 1220, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ marginBottom: 18 }}>
          <Link href="/inbox" style={{ display: 'inline-block', textDecoration: 'none', borderRadius: 10, padding: '8px 12px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 700, marginBottom: 14 }}>
            ← Mesajlara dön
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 8px' }}>Konuşma Detayı</h1>
              <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
                WhatsApp benzeri mesaj akışı, operatör önerisi ve manuel cevap alanı tek ekranda.
              </p>
            </div>
            {conversation ? <Badge label={responseState.label} tone={responseState.tone} /> : null}
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 16, fontWeight: 600 }}>{data.error}</div>
        ) : !conversation ? (
          <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 20, background: '#ffffff', color: '#6b7280' }}>Konuşma bulunamadı.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(320px, 0.85fr)', gap: 16, alignItems: 'start' }}>
            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', overflow: 'hidden' }}>
              <div style={{ borderBottom: '1px solid #e5e7eb', padding: 18, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginBottom: 8 }}>{conversation.customerDisplay}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Badge label={mapChannelLabel(conversation.channel)} tone="info" />
                    <Badge label={mapStatusLabel(conversation.status)} tone={String(conversation.status).toLowerCase() === 'open' ? 'success' : 'neutral'} />
                    <Badge label={conversation.contextProductName ? `Ürün: ${conversation.contextProductName}` : 'Ürün bağlamı yok'} tone={conversation.contextProductName ? 'info' : 'neutral'} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
                  <div><strong>Müşteri:</strong> {conversation.customerId || '-'}</div>
                  <div><strong>Son mesaj:</strong> {formatDate(conversation.lastMessageAt)}</div>
                  <div><strong>Toplam:</strong> {conversation.messages.length} mesaj</div>
                </div>
              </div>

              <div style={{ padding: 18, background: '#f3f4f6', minHeight: 460, display: 'grid', gap: 12, alignContent: 'start' }}>
                {conversation.messages.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>Bu konuşmada henüz mesaj görünmüyor.</div>
                ) : (
                  conversation.messages.map((message) => {
                    const incoming = message.direction === 'in';
                    return (
                      <div key={message.id} style={{ display: 'flex', justifyContent: incoming ? 'flex-start' : 'flex-end' }}>
                        <div style={{ maxWidth: '76%', borderRadius: incoming ? '18px 18px 18px 6px' : '18px 18px 6px 18px', padding: 14, background: incoming ? '#ffffff' : '#dcf8c6', color: '#111827', border: incoming ? '1px solid #e5e7eb' : '1px solid #bbf7d0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: incoming ? '#6b7280' : '#166534', marginBottom: 6 }}>
                            {mapDirectionLabel(message.direction)} · {mapMsgTypeLabel(message.msgType)}
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{message.textBody || 'Metin içeriği bulunmuyor.'}</div>
                          <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>{formatDate(message.createdAt)}</div>
                          {message.hasMediaLikePayload ? <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800 }}>Medya / kanıt içeriği mevcut olabilir</div> : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', padding: 18, background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>Operatör Mesajı</div>
                    <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
                      {hasWhatsAppLine ? 'Müşteriye manuel WhatsApp mesajı gönder.' : 'WhatsApp hattı bağlı değil, gönderim kapalı.'}
                    </div>
                  </div>
                  <Badge label={hasWhatsAppLine ? 'Gönderim aktif' : 'Gönderim kapalı'} tone={hasWhatsAppLine ? 'success' : 'warning'} />
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} onClick={() => setReplyText(suggestion)} disabled={!hasWhatsAppLine || sending} style={{ border: '1px solid #e5e7eb', borderRadius: 999, background: '#f9fafb', padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: hasWhatsAppLine && !sending ? 'pointer' : 'not-allowed', color: '#374151' }}>
                      Hızlı cevap
                    </button>
                  ))}
                </div>

                <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder={hasWhatsAppLine ? 'Müşteriye gönderilecek manuel mesajı yazın...' : 'WhatsApp hattı bağlanmadan manuel gönderim açılamaz.'} disabled={sending || !hasWhatsAppLine} style={{ width: '100%', minHeight: 110, borderRadius: 14, border: '1px solid #d1d5db', padding: 14, fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none', background: hasWhatsAppLine ? '#ffffff' : '#f9fafb' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{hasWhatsAppLine ? `${replyText.trim().length} karakter` : 'WhatsApp hattı bekleniyor'}</div>
                  <button onClick={handleSendReply} disabled={sending || !hasWhatsAppLine} style={{ border: 'none', borderRadius: 12, padding: '10px 16px', background: sending || !hasWhatsAppLine ? '#9ca3af' : '#111827', color: '#ffffff', fontWeight: 700, cursor: sending || !hasWhatsAppLine ? 'not-allowed' : 'pointer' }}>
                    {sending ? 'Gönderiliyor...' : 'Mesajı Gönder'}
                  </button>
                </div>

                {actionError ? <div style={{ marginTop: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 600 }}>{actionError}</div> : null}
                {actionSuccess ? <div style={{ marginTop: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 600 }}>{actionSuccess}</div> : null}
              </div>
            </section>

            <aside style={{ display: 'grid', gap: 16 }}>
              <section style={{ borderRadius: 18, padding: 18, ...operatorTone }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.35, opacity: 0.86 }}>Operatör için önerilen akış</div>
                <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 10, lineHeight: 1.35 }}>{responseState.needsReply ? 'Müşteriye yanıt ver' : operatorDeskState.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>{responseState.needsReply ? 'Son mesaj müşteriden geldi. Bu konuşma yanıt kuyruğunda tutulmalı.' : operatorDeskState.helper}</div>
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12, fontSize: 13, lineHeight: 1.7 }}>
                  <strong>Dikkat seviyesi:</strong> {responseState.needsReply ? 'Yüksek' : operatorDeskState.attention}<br />
                  <strong>Önerilen sıradaki adım:</strong> {responseState.needsReply ? 'Manuel cevap gönder' : operatorDeskState.recommendedStep}
                </div>
              </section>

              <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Kayıtlar arası geçiş</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Link href={flowContext.orderId ? `/orders/${flowContext.orderId}` : '/orders'} style={{ textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', fontWeight: 700 }}>Siparişe Git</Link>
                  <Link href={flowContext.caseId ? `/operations/${flowContext.caseId}` : '/operations'} style={{ textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', fontWeight: 700 }}>Operasyona Git</Link>
                  <Link href="/catalog" style={{ textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', fontWeight: 700 }}>Kataloğa Git</Link>
                </div>
              </section>

              <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Konuşma Özeti</div>
                <div style={{ color: '#4b5563', lineHeight: 1.7, fontSize: 14 }}>{flowContext.summary}</div>
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <Badge label={flowContext.orderLabel} tone={flowContext.orderId ? 'info' : 'neutral'} />
                  <Badge label={flowContext.caseLabel} tone={flowContext.caseId ? 'info' : 'neutral'} />
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>
    </AppShell>
  );
}
