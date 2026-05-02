'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { CustomerCrmProfileBox } from '@/components/apparel-panel/CustomerCrmProfileBox';
import { CustomerOperationCaseBox } from '@/components/apparel-panel/CustomerOperationCaseBox';
import { TokenHelpers } from '@/helpers/token-helpers';

type CustomerConversation = {
  id: string;
  channel: string | null;
  status: string | null;
  contextProductName: string | null;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  lastOperatorMessageAt: string | null;
  createdAt: string | null;
};

type CustomerOrder = {
  id: string;
  orderNo: string;
  status: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalAmount: number;
  currency: string | null;
  conversationId: string | null;
  orderedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CustomerOperationCase = {
  id: string;
  caseNo: string | null;
  caseType: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  linkedOrderId: string | null;
  conversationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CustomerLastMessage = {
  id: string;
  conversationId: string | null;
  direction: string | null;
  senderType: string | null;
  textBody: string | null;
  createdAt: string | null;
};

type CustomerProfile = {
  waId: string;
  displayName: string;
  memberId: string | null;
  memberCreatedAt: string | null;
  memberUpdatedAt: string | null;
  metrics: {
    conversationCount: number;
    openConversationCount: number;
    orderCount: number;
    paidOrderCount: number;
    operationCaseCount: number;
    openCaseCount: number;
    totalRevenue: number;
  };
  lastActivityAt: string | null;
  conversations: CustomerConversation[];
  orders: CustomerOrder[];
  operationCases: CustomerOperationCase[];
  lastMessages: CustomerLastMessage[];
};

type CustomerProfileResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  customer: CustomerProfile | null;
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

function formatMoney(amount: number | null | undefined, currency?: string | null) {
  const safeAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const safeCurrency = currency || 'TRY';

  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: safeCurrency,
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(2)} ${safeCurrency}`;
  }
}

function mapConversationStatusLabel(status: string | null | undefined) {
  if (status === 'open') return 'Açık';
  if (status === 'closed') return 'Kapalı';
  return status || '-';
}

function mapOrderStatusLabel(status: string | null | undefined) {
  if (status === 'draft') return 'Taslak';
  if (status === 'pending') return 'Bekliyor';
  if (status === 'confirmed') return 'Onaylandı';
  if (status === 'processing') return 'Hazırlanıyor';
  if (status === 'shipped') return 'Kargoda';
  if (status === 'delivered') return 'Teslim edildi';
  if (status === 'canceled') return 'İptal edildi';
  if (status === 'returned') return 'İade edildi';
  if (status === 'partially_returned') return 'Kısmi iade';
  return status || '-';
}

function mapFinancialStatusLabel(status: string | null | undefined) {
  if (status === 'unknown') return 'Bilinmiyor';
  if (status === 'pending') return 'Ödeme bekliyor';
  if (status === 'paid') return 'Ödendi';
  if (status === 'partially_paid') return 'Kısmi ödeme';
  if (status === 'refunded') return 'İade edildi';
  if (status === 'partially_refunded') return 'Kısmi iade';
  if (status === 'failed') return 'Başarısız';
  if (status === 'voided') return 'İptal';
  return status || '-';
}

function mapFulfillmentStatusLabel(status: string | null | undefined) {
  if (status === 'unfulfilled') return 'Hazırlanmadı';
  if (status === 'partial') return 'Kısmi hazırlandı';
  if (status === 'fulfilled') return 'Hazırlandı';
  if (status === 'returned') return 'İade';
  if (status === 'canceled') return 'İptal';
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

function mapPriorityLabel(priority: string | null | undefined) {
  if (priority === 'critical') return 'Kritik';
  if (priority === 'high') return 'Yüksek';
  if (priority === 'low') return 'Düşük';
  return 'Normal';
}

function mapSenderLabel(senderType: string | null | undefined, direction?: string | null) {
  if (senderType === 'customer') return 'Müşteri';
  if (senderType === 'operator') return 'Operatör';
  if (senderType === 'ai') return 'AI Asistan';
  if (senderType === 'system') return 'Sistem';
  if (direction === 'in') return 'Müşteri';
  if (direction === 'out') return 'AI Asistan';
  return 'Mesaj';
}

function toneForStatus(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'paid' || status === 'fulfilled' || status === 'delivered' || status === 'resolved' || status === 'closed') return 'success';
  if (status === 'confirmed' || status === 'processing' || status === 'shipped' || status === 'open') return 'info';
  if (status === 'pending' || status === 'unfulfilled' || status === 'partial' || status === 'in_progress' || status === 'waiting_customer') return 'warning';
  if (status === 'canceled' || status === 'failed' || status === 'returned') return 'danger';
  return 'neutral';
}

function toneForPriority(priority: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'low') return 'neutral';
  return 'info';
}

function Pill({
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
    <span style={{ display: 'inline-flex', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700, ...styles }}>
      {label}
    </span>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#111827' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
    </div>
  );
}

export default function CustomerProfilePage() {
  const params = useParams<{ customerWaId: string }>();
  const rawCustomerWaId = Array.isArray(params?.customerWaId) ? params.customerWaId[0] : params?.customerWaId;
  const customerWaId = rawCustomerWaId ? decodeURIComponent(rawCustomerWaId) : '';
  const [data, setData] = useState<CustomerProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        if (!customerWaId) {
          setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, customer: null, error: 'customerWaId bulunamadı.' });
          return;
        }

        const iframeToken = await TokenHelpers.getTokenForIframeApp();

        if (!iframeToken) {
          setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, customer: null, error: 'iFrame JWT token alınamadı.' });
          return;
        }

        const response = await fetch(`/api/apparel/customers/${encodeURIComponent(customerWaId)}`, {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = await response.json();
        setData(raw);
      } catch (error) {
        setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, customer: null, error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [customerWaId]);

  const customer = data?.customer || null;
  const latestOrder = useMemo(() => customer?.orders[0] || null, [customer?.orders]);
  const latestConversation = useMemo(() => customer?.conversations[0] || null, [customer?.conversations]);
  const latestCase = useMemo(() => customer?.operationCases[0] || null, [customer?.operationCases]);

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ marginBottom: 18 }}>
          <Link href="/inbox" style={{ display: 'inline-block', textDecoration: 'none', borderRadius: 10, padding: '8px 12px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 700, marginBottom: 14 }}>
            ← Mesajlara dön
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 8px' }}>Müşteri Profili</h1>
              <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
                Müşterinin konuşma, sipariş, operasyon ve son mesaj geçmişini tek ekranda izleyin.
              </p>
            </div>
            {customer ? <Pill label={customer.waId} tone="info" /> : null}
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 700 }}>{data.error}</div>
        ) : !customer ? (
          <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 20, background: '#ffffff', color: '#6b7280' }}>Müşteri bulunamadı.</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <MetricCard label="Toplam Konuşma" value={customer.metrics.conversationCount} helper="Bu müşteriye bağlı konuşma sayısı." />
              <MetricCard label="Açık Konuşma" value={customer.metrics.openConversationCount} helper="Şu an açık takip edilen konuşmalar." />
              <MetricCard label="Toplam Sipariş" value={customer.metrics.orderCount} helper="Bu müşteriye bağlı sipariş sayısı." />
              <MetricCard label="Toplam Ciro" value={formatMoney(customer.metrics.totalRevenue, latestOrder?.currency || 'TRY')} helper="Ödenmiş siparişlerden hesaplanan toplam tutar." />
              <MetricCard label="Operasyon Vakası" value={customer.metrics.operationCaseCount} helper="Bu müşteriye bağlı operasyon kayıtları." />
              <MetricCard label="Açık Vaka" value={customer.metrics.openCaseCount} helper="Açık, incelenen veya müşteri bekleyen operasyon kayıtları." />
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 16, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <InfoCard title="Müşteri Özeti">
                  <div style={{ display: 'grid', gap: 10, color: '#374151', lineHeight: 1.6 }}>
                    <div><strong>WhatsApp ID:</strong> {customer.waId}</div>
                    <div><strong>Tenant member:</strong> {customer.memberId || '-'}</div>
                    <div><strong>Son aktivite:</strong> {formatDate(customer.lastActivityAt)}</div>
                    <div><strong>İlk kayıt:</strong> {formatDate(customer.memberCreatedAt)}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {customer.metrics.openConversationCount > 0 ? <Pill label="Açık konuşma var" tone="info" /> : <Pill label="Açık konuşma yok" tone="neutral" />}
                      {customer.metrics.openCaseCount > 0 ? <Pill label="Açık vaka var" tone="warning" /> : <Pill label="Açık vaka yok" tone="success" />}
                      {customer.metrics.orderCount > 0 ? <Pill label="Siparişli müşteri" tone="success" /> : <Pill label="Sipariş yok" tone="neutral" />}
                    </div>
                  </div>
                </InfoCard>

                <InfoCard title="Konuşmalar">
                  {customer.conversations.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Bu müşteriye bağlı konuşma yok.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {customer.conversations.map((conversation) => (
                        <Link key={conversation.id} href={`/inbox/${conversation.id}`} style={{ textDecoration: 'none', color: '#111827', border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, background: '#f9fafb' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <Pill label={conversation.channel || 'whatsapp'} tone="info" />
                            <Pill label={mapConversationStatusLabel(conversation.status)} tone={toneForStatus(conversation.status)} />
                            {conversation.contextProductName ? <Pill label={conversation.contextProductName} tone="neutral" /> : null}
                          </div>
                          <div style={{ fontWeight: 900 }}>Konuşmaya Git →</div>
                          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Son mesaj: {formatDate(conversation.lastMessageAt || conversation.createdAt)}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </InfoCard>

                <InfoCard title="Siparişler">
                  {customer.orders.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Bu müşteriye bağlı sipariş yok.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {customer.orders.map((order) => (
                        <div key={order.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, background: '#f9fafb' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <Link href={`/orders/${order.id}`} style={{ color: '#111827', fontWeight: 900, textDecoration: 'none' }}>{order.orderNo}</Link>
                              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>{formatDate(order.updatedAt || order.orderedAt || order.createdAt)}</div>
                            </div>
                            <div style={{ fontWeight: 900 }}>{formatMoney(order.totalAmount, order.currency)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                            <Pill label={mapOrderStatusLabel(order.status)} tone={toneForStatus(order.status)} />
                            <Pill label={mapFinancialStatusLabel(order.financialStatus)} tone={toneForStatus(order.financialStatus)} />
                            <Pill label={mapFulfillmentStatusLabel(order.fulfillmentStatus)} tone={toneForStatus(order.fulfillmentStatus)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </InfoCard>

                <InfoCard title="Operasyon Vakaları">
                  {customer.operationCases.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Bu müşteriye bağlı operasyon vakası yok.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {customer.operationCases.map((caseItem) => (
                        <div key={caseItem.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, background: '#f9fafb' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <Pill label={caseItem.caseNo || 'Vaka'} tone="info" />
                            <Pill label={mapCaseTypeLabel(caseItem.caseType)} tone="warning" />
                            <Pill label={mapCaseStatusLabel(caseItem.status)} tone={toneForStatus(caseItem.status)} />
{caseItem.status === 'resolved' || caseItem.status === 'closed' ? (
  <Pill label="Arşiv" tone="success" />
) : null}
<Pill label={`Öncelik: ${mapPriorityLabel(caseItem.priority)}`} tone={toneForPriority(caseItem.priority)} />
                          </div>
                          <div style={{ fontWeight: 900 }}>{caseItem.title || 'Başlıksız operasyon kaydı'}</div>
                          {caseItem.description ? <div style={{ marginTop: 6, color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>{caseItem.description}</div> : null}
                          <div style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>Son güncelleme: {formatDate(caseItem.updatedAt || caseItem.createdAt)}</div>
                         <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
  <Link
    href={`/operations/${encodeURIComponent(caseItem.caseNo || caseItem.id)}`}
    style={{ color: '#2563eb', fontWeight: 900, textDecoration: 'none', fontSize: 13 }}
  >
    Vaka Detayına Git →
  </Link>
  {caseItem.linkedOrderId ? <Link href={`/orders/${caseItem.linkedOrderId}`} style={{ color: '#111827', fontWeight: 800, textDecoration: 'none', fontSize: 13 }}>Siparişe Git →</Link> : null}
  {caseItem.conversationId ? <Link href={`/inbox/${caseItem.conversationId}`} style={{ color: '#111827', fontWeight: 800, textDecoration: 'none', fontSize: 13 }}>Konuşmaya Git →</Link> : null}
</div>
                        </div>
                      ))}
                    </div>
                  )}
                </InfoCard>
              </div>

              <aside style={{ display: 'grid', gap: 16 }}>
                <CustomerCrmProfileBox customerWaId={customer.waId} />
                <CustomerOperationCaseBox customerWaId={customer.waId} />

                <InfoCard title="Hızlı Bakış">
                  <div style={{ display: 'grid', gap: 10, color: '#374151', lineHeight: 1.6 }}>
                    <div><strong>Son konuşma:</strong> {latestConversation ? formatDate(latestConversation.lastMessageAt || latestConversation.createdAt) : '-'}</div>
                    <div><strong>Son sipariş:</strong> {latestOrder ? latestOrder.orderNo : '-'}</div>
                    <div><strong>Son vaka:</strong> {latestCase ? latestCase.caseNo || latestCase.title || '-' : '-'}</div>
{latestConversation ? <Link href={`/inbox/${latestConversation.id}`} style={{ color: '#111827', fontWeight: 800, textDecoration: 'none' }}>Son konuşmaya git →</Link> : null}
{latestOrder ? <Link href={`/orders/${latestOrder.id}`} style={{ color: '#111827', fontWeight: 800, textDecoration: 'none' }}>Son siparişe git →</Link> : null}
{latestCase ? (
  <Link
    href={`/operations/${encodeURIComponent(latestCase.caseNo || latestCase.id)}`}
    style={{ color: '#2563eb', fontWeight: 900, textDecoration: 'none' }}
  >
    Son vakaya git →
  </Link>
) : null}
<Link href="/operations" style={{ color: '#111827', fontWeight: 800, textDecoration: 'none' }}>Operasyonlara git →</Link>
                  </div>
                </InfoCard>

                <InfoCard title="Son Mesajlar">
                  {customer.lastMessages.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Son mesaj bulunmuyor.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {customer.lastMessages.map((message) => (
                        <div key={message.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, background: '#f9fafb' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                            <Pill label={mapSenderLabel(message.senderType, message.direction)} tone={message.direction === 'in' ? 'warning' : 'info'} />
                            <span style={{ color: '#6b7280', fontSize: 12, alignSelf: 'center' }}>{formatDate(message.createdAt)}</span>
                          </div>
                          <div style={{ color: '#374151', lineHeight: 1.5, fontSize: 13 }}>{message.textBody || '-'}</div>
                          {message.conversationId ? <Link href={`/inbox/${message.conversationId}`} style={{ display: 'inline-block', marginTop: 8, color: '#111827', fontWeight: 800, textDecoration: 'none', fontSize: 13 }}>Konuşmayı aç →</Link> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </InfoCard>
              </aside>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
