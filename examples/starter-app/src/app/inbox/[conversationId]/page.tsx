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

function mapSenderLabel(senderType: string | null | undefined, direction?: 'in' | 'out' | null) {
  if (senderType === 'customer') return 'Müşteri';
  if (senderType === 'operator') return 'Operatör';
  if (senderType === 'ai') return 'AI Asistan';
  if (senderType === 'system') return 'Sistem';
  if (direction === 'in') return 'Müşteri';
  if (direction === 'out') return 'AI Asistan';
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

function isAfter(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return false;
  if (!b) return true;
  const at = new Date(a).getTime();
  const bt = new Date(b).getTime();
  return Number.isFinite(at) && Number.isFinite(bt) ? at > bt : false;
}

function getResponseState(conversation: ConversationDetailResponse['conversation']) {
  const isOpen = String(conversation?.status || '').toLowerCase() === 'open';
  const customerAfterOperator = isAfter(conversation?.lastCustomerMessageAt, conversation?.lastOperatorMessageAt);
  const customerAfterReview = isAfter(conversation?.lastCustomerMessageAt, conversation?.operatorReviewedAt);
  const needsReply = isOpen && customerAfterOperator && customerAfterReview;

  return {
    needsReply,
    label: needsReply ? 'Yanıt bekliyor' : conversation?.operatorReviewedAt ? 'İncelendi' : 'Cevaplandı',
    tone: needsReply ? ('danger' as const) : conversation?.operatorReviewedAt ? ('info' as const) : ('success' as const),
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
  const [reviewing, setReviewing] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
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

  const handleReviewConversation = async () => {
    try {
      setActionError(null);
      setActionSuccess(null);

      if (!conversationId) return setActionError('conversationId bulunamadı.');

      setReviewing(true);
      const iframeToken = await TokenHelpers.getTokenForIframeApp();
      if (!iframeToken) return setActionError('iFrame JWT token alınamadı.');

      const response = await fetch(`/api/apparel/conversations/${conversationId}/review`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Operatör AI cevabını yeterli gördü.' }),
      });

      const raw = await response.json();
      if (!response.ok || !raw?.ok) throw new Error(raw?.error || 'Konuşma incelendi olarak işaretlenemedi.');

      setActionSuccess('Konuşma incelendi olarak işaretlendi. Müşteriye WhatsApp mesajı gönderilmedi.');
      await loadConversation({ silent: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'İnceleme kaydı sırasında hata oluştu.');
    } finally {
      setReviewing(false);
    }
  };

  const handleConversationStatusChange = async (action: 'close' | 'reopen') => {
  try {
    setActionError(null);
    setActionSuccess(null);

    if (!conversationId) return setActionError('conversationId bulunamadı.');

    setStatusChanging(true);
    const iframeToken = await TokenHelpers.getTokenForIframeApp();
    if (!iframeToken) return setActionError('iFrame JWT token alınamadı.');

    const response = await fetch(`/api/apparel/conversations/${conversationId}/status`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: 'JWT ' + iframeToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });

    const raw = await response.json();
    if (!response.ok || !raw?.ok) {
      throw new Error(raw?.error || 'Konuşma durumu güncellenemedi.');
    }

    setActionSuccess(
      action === 'close'
        ? 'Konuşma kapatıldı.'
        : 'Konuşma tekrar açıldı.',
    );

    await loadConversation({ silent: true });
  } catch (error) {
    setActionError(
      error instanceof Error
        ? error.message
        : 'Konuşma durumu güncellenirken hata oluştu.',
    );
  } finally {
    setStatusChanging(false);
  }
};
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
                  {conversation.operatorReviewedAt ? <div><strong>İncelendi:</strong> {formatDate(conversation.operatorReviewedAt)}</div> : null}
                </div>
              </div>

              <div style={{ padding: 18, background: '#f3f4f6', minHeight: 460, display: 'grid', gap: 12, alignContent: 'start' }}>
                {conversation.messages.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>Bu konuşmada henüz mesaj görünmüyor.</div>
                ) : (
                  conversation.messages.map((message) => {
                    const incoming = message.senderType === 'customer' || message.direction === 'in';
                    const senderLabel = mapSenderLabel(message.senderType, message.direction);
                    return (
                      <div key={message.id} style={{ display: 'flex', justifyContent: incoming ? 'flex-start' : 'flex-end' }}>
                        <div style={{ maxWidth: '76%', borderRadius: incoming ? '18px 18px 18px 6px' : '18px 18px 6px 18px', padding: 14, background: incoming ? '#ffffff' : '#dcf8c6', color: '#111827', border: incoming ? '1px solid #e5e7eb' : '1px solid #bbf7d0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: incoming ? '#6b7280' : '#166534', marginBottom: 6 }}>
                            {senderLabel} · {mapMsgTypeLabel(message.msgType)}
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
                <div style={{ border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
  <div>
    <div style={{ fontWeight: 900, marginBottom: 4 }}>Konuşma Durumu</div>
    <div style={{ fontSize: 13, lineHeight: 1.6, color: '#4b5563' }}>
      Açık konuşmayı kapatabilir veya kapalı konuşmayı tekrar açabilirsiniz.
    </div>
  </div>

  <button
    onClick={() =>
      handleConversationStatusChange(
        String(conversation.status || '').toLowerCase() === 'open'
          ? 'close'
          : 'reopen',
      )
    }
    disabled={statusChanging}
    style={{
      border: 'none',
      borderRadius: 12,
      padding: '10px 14px',
      background: statusChanging
        ? '#9ca3af'
        : String(conversation.status || '').toLowerCase() === 'open'
          ? '#991b1b'
          : '#065f46',
      color: '#ffffff',
      fontWeight: 800,
      cursor: statusChanging ? 'not-allowed' : 'pointer',
    }}
  >
    {statusChanging
      ? 'Güncelleniyor...'
      : String(conversation.status || '').toLowerCase() === 'open'
        ? 'Konuşmayı kapat'
        : 'Konuşmayı tekrar aç'}
  </button>
</div>
                {responseState.needsReply ? (
                  <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 14, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 900, marginBottom: 4 }}>AI cevabı yeterliyse müşteriye tekrar mesaj göndermeden kuyruğu temizleyebilirsiniz.</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>Bu işlem WhatsApp mesajı göndermez; yalnızca konuşmayı operatör tarafından incelendi olarak işaretler.</div>
                    </div>
                    <button onClick={handleReviewConversation} disabled={reviewing} style={{ border: 'none', borderRadius: 12, padding: '10px 14px', background: reviewing ? '#9ca3af' : '#1d4ed8', color: '#ffffff', fontWeight: 800, cursor: reviewing ? 'not-allowed' : 'pointer' }}>
                      {reviewing ? 'İşaretleniyor...' : 'İncelendi olarak işaretle'}
                    </button>
                  </div>
                ) : null}

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
              <section style={{ borderRadius: 18, padding: 18, ...(responseState.needsReply ? { border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' } : operatorTone) }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.35, opacity: 0.86 }}>Operatör için önerilen akış</div>
                <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 10, lineHeight: 1.35 }}>{responseState.needsReply ? 'Müşteriye yanıt ver veya incele' : responseState.label === 'İncelendi' ? 'Operatör tarafından incelendi' : operatorDeskState.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>{responseState.needsReply ? 'AI cevabı yeterliyse “İncelendi olarak işaretle”; değilse manuel cevap gönder.' : responseState.label === 'İncelendi' ? 'Bu konuşma müşteriye ek mesaj gönderilmeden operatör tarafından kontrol edildi.' : operatorDeskState.helper}</div>
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 12, fontSize: 13, lineHeight: 1.7 }}>
                  <strong>Dikkat seviyesi:</strong> {responseState.needsReply ? 'Yüksek' : operatorDeskState.attention}<br />
                  <strong>Önerilen sıradaki adım:</strong> {responseState.needsReply ? 'Manuel cevap gönder veya incelendi işaretle' : operatorDeskState.recommendedStep}
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
