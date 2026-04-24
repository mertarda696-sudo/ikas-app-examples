'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { OrderStatusUpdateBox } from '@/components/apparel-panel/OrderStatusUpdateBox';
import { OrderOperationCaseBox } from '@/components/apparel-panel/OrderOperationCaseBox';
import { TokenHelpers } from '@/helpers/token-helpers';

type OrderItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  sku: string | null;
  productName: string;
  variantTitle: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  currency: string | null;
  unitPrice: number;
  discountAmount: number;
  totalAmount: number;
  fulfillmentStatus: string | null;
  returnStatus: string | null;
};

type LinkedConversation = {
  id: string;
  status: string | null;
  channel: string | null;
  lastMessageAt: string | null;
  contextProductName: string | null;
};

type LinkedOperationCase = {
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

type OrderDetail = {
  id: string;
  orderNo: string;
  sourcePlatform: string | null;
  externalOrderId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerWaId: string | null;
  status: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  currency: string | null;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string | null;
  shippingMethod: string | null;
  cargoCompany: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingAddress: unknown | null;
  billingAddress: unknown | null;
  note: string | null;
  tags: string[];
  conversationId: string | null;
  memberId: string | null;
  orderedAt: string | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  canceledAt: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items: OrderItem[];
  linkedConversation: LinkedConversation | null;
  linkedOperationCases: LinkedOperationCase[];
};

type OrderDetailResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  order: OrderDetail | null;
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

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = Array.isArray(params?.orderId) ? params.orderId[0] : params?.orderId;
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        if (!orderId) {
          setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, order: null, error: 'orderId bulunamadı.' });
          return;
        }

        const iframeToken = await TokenHelpers.getTokenForIframeApp();

        if (!iframeToken) {
          setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, order: null, error: 'iFrame JWT token alınamadı.' });
          return;
        }

        const response = await fetch(`/api/apparel/orders/${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = await response.json();
        setData(raw);
      } catch (error) {
        setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, order: null, error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [orderId]);

  const order = data?.order || null;
  const totalItemQty = useMemo(() => order?.items.reduce((sum, item) => sum + item.quantity, 0) || 0, [order?.items]);

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ marginBottom: 18 }}>
          <Link href="/orders" style={{ display: 'inline-block', textDecoration: 'none', borderRadius: 10, padding: '8px 12px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 700, marginBottom: 14 }}>
            ← Siparişlere dön
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 8px' }}>Sipariş Detayı</h1>
              <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
                Sipariş, ürün kalemleri, ödeme, kargo, konuşma ve operasyon bağlantılarını tek ekranda izleyin.
              </p>
            </div>
            {order ? <Pill label={order.orderNo} tone="info" /> : null}
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 700 }}>{data.error}</div>
        ) : !order ? (
          <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 20, background: '#ffffff', color: '#6b7280' }}>Sipariş bulunamadı.</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              <InfoCard title="Sipariş No">
                <div style={{ fontSize: 24, fontWeight: 900 }}>{order.orderNo}</div>
                <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>{order.sourcePlatform || 'manual'}</div>
              </InfoCard>

              <InfoCard title="Toplam Tutar">
                <div style={{ fontSize: 24, fontWeight: 900 }}>{formatMoney(order.totalAmount, order.currency)}</div>
                <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>{totalItemQty} ürün adedi</div>
              </InfoCard>

              <InfoCard title="Sipariş Durumu">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Pill label={mapOrderStatusLabel(order.status)} tone={toneForStatus(order.status)} />
                  <Pill label={mapFinancialStatusLabel(order.financialStatus)} tone={toneForStatus(order.financialStatus)} />
                  <Pill label={mapFulfillmentStatusLabel(order.fulfillmentStatus)} tone={toneForStatus(order.fulfillmentStatus)} />
                </div>
              </InfoCard>

              <InfoCard title="Bağlantılar">
                <div style={{ display: 'grid', gap: 8 }}>
                  {order.linkedConversation ? (
                    <Link href={`/inbox/${order.linkedConversation.id}`} style={{ color: '#111827', fontWeight: 800, textDecoration: 'none' }}>
                      Konuşmaya Git →
                    </Link>
                  ) : (
                    <span style={{ color: '#6b7280' }}>Konuşma bağlı değil</span>
                  )}
                  <Link href="/operations" style={{ color: '#111827', fontWeight: 800, textDecoration: 'none' }}>
                    Operasyonlara Git →
                  </Link>
                </div>
              </InfoCard>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.85fr)', gap: 16, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <InfoCard title="Ürün Kalemleri">
                  <div style={{ display: 'grid', gap: 10 }}>
                    {order.items.length === 0 ? (
                      <div style={{ color: '#6b7280' }}>Sipariş kalemi bulunmuyor.</div>
                    ) : (
                      order.items.map((item) => (
                        <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, background: '#f9fafb' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 900, marginBottom: 4 }}>{item.productName}</div>
                              <div style={{ color: '#6b7280', fontSize: 13 }}>
                                {[
                                  item.sku ? `SKU: ${item.sku}` : null,
                                  item.color ? `Renk: ${item.color}` : null,
                                  item.size ? `Beden: ${item.size}` : null,
                                  `Adet: ${item.quantity}`,
                                ].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 900 }}>{formatMoney(item.totalAmount, item.currency || order.currency)}</div>
                              <div style={{ color: '#6b7280', fontSize: 12 }}>{formatMoney(item.unitPrice, item.currency || order.currency)} / adet</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </InfoCard>

                <InfoCard title="Bağlı Operasyon Vakaları">
                  {order.linkedOperationCases.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Bu siparişe bağlı operasyon vakası yok.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {order.linkedOperationCases.map((caseItem) => (
                        <div key={caseItem.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, background: '#f9fafb' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <Pill label={caseItem.caseNo || 'Vaka'} tone="info" />
                            <Pill label={mapCaseTypeLabel(caseItem.caseType)} tone="warning" />
                            <Pill label={mapCaseStatusLabel(caseItem.status)} tone={toneForStatus(caseItem.status)} />
                            <Pill label={`Öncelik: ${mapPriorityLabel(caseItem.priority)}`} tone={toneForPriority(caseItem.priority)} />
                          </div>
                          <div style={{ fontWeight: 900 }}>{caseItem.title || 'Başlıksız operasyon kaydı'}</div>
                          {caseItem.description ? <div style={{ marginTop: 6, color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>{caseItem.description}</div> : null}
                          <div style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>Son güncelleme: {formatDate(caseItem.updatedAt || caseItem.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </InfoCard>
              </div>

              <aside style={{ display: 'grid', gap: 16 }}>
                <OrderStatusUpdateBox
                  orderId={order.id}
                  initialStatus={order.status}
                  initialFinancialStatus={order.financialStatus}
                  initialFulfillmentStatus={order.fulfillmentStatus}
                  initialShippingMethod={order.shippingMethod}
                  initialCargoCompany={order.cargoCompany}
                  initialTrackingNumber={order.trackingNumber}
                  initialTrackingUrl={order.trackingUrl}
                  initialNote={order.note}
                />

                <OrderOperationCaseBox
                 orderId={order.id}
                 orderNo={order.orderNo}
              />

                <InfoCard title="Müşteri">
                  <div style={{ display: 'grid', gap: 8, color: '#374151', lineHeight: 1.6 }}>
                    <div><strong>Ad:</strong> {order.customerName || '-'}</div>
                    <div><strong>WhatsApp:</strong> {order.customerWaId || '-'}</div>
                    <div><strong>Telefon:</strong> {order.customerPhone || '-'}</div>
                    <div><strong>E-posta:</strong> {order.customerEmail || '-'}</div>
                  </div>
                </InfoCard>

                <InfoCard title="Ödeme ve Kargo">
                  <div style={{ display: 'grid', gap: 8, color: '#374151', lineHeight: 1.6 }}>
                    <div><strong>Ödeme yöntemi:</strong> {order.paymentMethod || '-'}</div>
                    <div><strong>Kargo yöntemi:</strong> {order.shippingMethod || '-'}</div>
                    <div><strong>Kargo firması:</strong> {order.cargoCompany || '-'}</div>
                    <div><strong>Takip no:</strong> {order.trackingNumber || '-'}</div>
                    {order.trackingUrl ? (
                      <a href={order.trackingUrl} target="_blank" rel="noreferrer" style={{ color: '#111827', fontWeight: 800, textDecoration: 'none' }}>
                        Kargo takip linkini aç →
                      </a>
                    ) : null}
                  </div>
                </InfoCard>

                <InfoCard title="Tutar Özeti">
                  <div style={{ display: 'grid', gap: 8, color: '#374151', lineHeight: 1.6 }}>
                    <div><strong>Ara toplam:</strong> {formatMoney(order.subtotalAmount, order.currency)}</div>
                    <div><strong>İndirim:</strong> {formatMoney(order.discountAmount, order.currency)}</div>
                    <div><strong>Kargo:</strong> {formatMoney(order.shippingAmount, order.currency)}</div>
                    <div><strong>Vergi:</strong> {formatMoney(order.taxAmount, order.currency)}</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}><strong>Toplam:</strong> {formatMoney(order.totalAmount, order.currency)}</div>
                  </div>
                </InfoCard>

                <InfoCard title="Zaman Çizelgesi">
                  <div style={{ display: 'grid', gap: 8, color: '#374151', lineHeight: 1.6 }}>
                    <div><strong>Sipariş:</strong> {formatDate(order.orderedAt || order.createdAt)}</div>
                    <div><strong>Ödeme:</strong> {formatDate(order.paidAt)}</div>
                    <div><strong>Hazırlama:</strong> {formatDate(order.fulfilledAt)}</div>
                    <div><strong>Teslim:</strong> {formatDate(order.deliveredAt)}</div>
                    <div><strong>İptal:</strong> {formatDate(order.canceledAt)}</div>
                    <div><strong>Son güncelleme:</strong> {formatDate(order.updatedAt)}</div>
                  </div>
                </InfoCard>

                {order.note ? (
                  <InfoCard title="Not">
                    <div style={{ color: '#374151', lineHeight: 1.6 }}>{order.note}</div>
                  </InfoCard>
                ) : null}
              </aside>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
