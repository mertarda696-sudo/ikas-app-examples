'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
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

type OrderRow = {
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
  note: string | null;
  conversationId: string | null;
  orderedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items: OrderItem[];
};

type OrdersResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  metrics: {
    total: number;
    active: number;
    paid: number;
    unfulfilled: number;
    totalRevenue: number;
  };
  items: OrderRow[];
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

function statusTone(
  status: string | null | undefined,
): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'paid' || status === 'fulfilled' || status === 'delivered') return 'success';
  if (status === 'confirmed' || status === 'processing' || status === 'shipped') return 'info';
  if (status === 'pending' || status === 'unfulfilled' || status === 'partial') return 'warning';
  if (status === 'canceled' || status === 'failed' || status === 'returned') return 'danger';

  return 'neutral';
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

function getOrderAttention(order: OrderRow) {
  if (order.financialStatus === 'pending') {
    return {
      title: 'Ödeme kontrolü bekliyor',
      helper: 'Bu sipariş için ödeme durumu henüz tamamlanmamış görünüyor.',
      tone: 'warning' as const,
    };
  }

  if (order.fulfillmentStatus === 'unfulfilled') {
    return {
      title: 'Hazırlanmayı bekliyor',
      helper: 'Sipariş ödenmiş veya onaylanmış olabilir; fulfillment süreci takip edilmeli.',
      tone: 'info' as const,
    };
  }

  if (order.status === 'delivered') {
    return {
      title: 'Teslim edildi',
      helper: 'Sipariş tamamlanmış görünüyor. İade/değişim talebi oluşursa operasyon kaydıyla takip edilir.',
      tone: 'success' as const,
    };
  }

  if (order.status === 'canceled' || order.status === 'returned') {
    return {
      title: 'Kapanmış sipariş',
      helper: 'Bu sipariş iptal/iade durumunda görünüyor.',
      tone: 'neutral' as const,
    };
  }

  return {
    title: 'Genel takip',
    helper: 'Sipariş, ödeme ve kargo bilgileri birlikte takip edilebilir.',
    tone: 'neutral' as const,
  };
}

export default function OrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
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
            metrics: {
              total: 0,
              active: 0,
              paid: 0,
              unfulfilled: 0,
              totalRevenue: 0,
            },
            items: [],
            error: 'iFrame JWT token alınamadı.',
          });
          return;
        }

        const response = await fetch('/api/apparel/orders', {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = await response.json();
        setData(raw);
      } catch (error) {
        setData({
          ok: false,
          fetchedAt: new Date().toISOString(),
          tenant: null,
          metrics: {
            total: 0,
            active: 0,
            paid: 0,
            unfulfilled: 0,
            totalRevenue: 0,
          },
          items: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const rows = useMemo(() => data?.items || [], [data?.items]);

  const metrics = data?.metrics || {
    total: 0,
    active: 0,
    paid: 0,
    unfulfilled: 0,
    totalRevenue: 0,
  };

  const currency = rows[0]?.currency || 'TRY';

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
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
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Siparişler</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Sipariş, ödeme, kargo ve bağlı konuşma kayıtlarını canlı Supabase sipariş verisiyle izleyin.
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
            Bu sayfa artık placeholder değil. Kayıtlar <strong>commerce_orders</strong> ve{' '}
            <strong>commerce_order_items</strong> tablolarından canlı okunur.
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
              fontWeight: 700,
            }}
          >
            {data.error}
          </div>
        ) : (
          <>
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <MetricCard
                label="Toplam Sipariş"
                value={metrics.total}
                helper="Bu tenant için görünen toplam sipariş sayısı."
              />
              <MetricCard
                label="Aktif Sipariş"
                value={metrics.active}
                helper="Bekleyen, onaylı, hazırlanan veya kargodaki siparişler."
              />
              <MetricCard
                label="Ödenmiş Sipariş"
                value={metrics.paid}
                helper="Ödemesi alınmış veya kısmi ödeme alınmış siparişler."
              />
              <MetricCard
                label="Hazırlanmayı Bekleyen"
                value={metrics.unfulfilled}
                helper="Fulfillment süreci tamamlanmamış siparişler."
              />
              <MetricCard
                label="Toplam Ciro"
                value={formatMoney(metrics.totalRevenue, currency)}
                helper="Ödenmiş siparişlerin toplam tutarı."
              />
            </section>

            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                background: '#ffffff',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Sipariş Listesi
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1320 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {[
                        'Sipariş No',
                        'Müşteri',
                        'Ürünler',
                        'Tutar',
                        'Sipariş Durumu',
                        'Ödeme',
                        'Hazırlık / Kargo',
                        'Kargo Bilgisi',
                        'Öncelik / Not',
                        'Konuşma',
                        'Detay',
                        'Son Güncelleme',
                      ].map((header) => (
                        <th
                          key={header}
                          style={{
                            textAlign: 'left',
                            padding: 14,
                            fontSize: 13,
                            color: '#6b7280',
                            fontWeight: 800,
                            borderBottom: '1px solid #e5e7eb',
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => {
                      const attention = getOrderAttention(row);

                      return (
                        <tr key={row.id}>
                          <td
                            style={{
                              padding: 14,
                              borderBottom: '1px solid #f3f4f6',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Link
                              href={`/orders/${row.id}`}
                              style={{ textDecoration: 'none', color: '#111827', fontWeight: 900 }}
                            >
                              {row.orderNo}
                            </Link>
                            <div style={{ marginTop: 4, color: '#6b7280', fontSize: 12 }}>
                              {row.sourcePlatform || 'manual'}
                            </div>
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ fontWeight: 800 }}>
                              {row.customerName || row.customerWaId || row.customerPhone || '-'}
                            </div>
                            <div style={{ marginTop: 4, color: '#6b7280', fontSize: 12 }}>
                              {row.customerWaId || row.customerPhone || row.customerEmail || '-'}
                            </div>
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'grid', gap: 6 }}>
                              {row.items.length === 0 ? (
                                <span style={{ color: '#6b7280' }}>Kalem yok</span>
                              ) : (
                                row.items.map((item) => (
                                  <div key={item.id}>
                                    <div style={{ fontWeight: 800 }}>{item.productName}</div>
                                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                                      {[
                                        item.color ? `Renk: ${item.color}` : null,
                                        item.size ? `Beden: ${item.size}` : null,
                                        item.quantity ? `Adet: ${item.quantity}` : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </td>

                          <td
                            style={{
                              padding: 14,
                              borderBottom: '1px solid #f3f4f6',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatMoney(row.totalAmount, row.currency)}
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            <Pill
                              label={mapOrderStatusLabel(row.status)}
                              tone={statusTone(row.status)}
                            />
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            <Pill
                              label={mapFinancialStatusLabel(row.financialStatus)}
                              tone={statusTone(row.financialStatus)}
                            />
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            <Pill
                              label={mapFulfillmentStatusLabel(row.fulfillmentStatus)}
                              tone={statusTone(row.fulfillmentStatus)}
                            />
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ fontWeight: 700 }}>{row.cargoCompany || '-'}</div>
                            <div style={{ marginTop: 4, color: '#6b7280', fontSize: 12 }}>
                              {row.trackingNumber || row.shippingMethod || '-'}
                            </div>
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            <div
                              style={{
                                border:
                                  attention.tone === 'warning'
                                    ? '1px solid #fde68a'
                                    : attention.tone === 'success'
                                      ? '1px solid #bbf7d0'
                                      : attention.tone === 'info'
                                        ? '1px solid #bfdbfe'
                                        : '1px solid #e5e7eb',
                                borderRadius: 12,
                                padding: 10,
                                background:
                                  attention.tone === 'warning'
                                    ? '#fffbeb'
                                    : attention.tone === 'success'
                                      ? '#f0fdf4'
                                      : attention.tone === 'info'
                                        ? '#eff6ff'
                                        : '#f9fafb',
                                color:
                                  attention.tone === 'warning'
                                    ? '#92400e'
                                    : attention.tone === 'success'
                                      ? '#166534'
                                      : attention.tone === 'info'
                                        ? '#1d4ed8'
                                        : '#374151',
                              }}
                            >
                              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                                {attention.title}
                              </div>
                              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                                {attention.helper}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            {row.conversationId ? (
                              <Link
                                href={`/inbox/${row.conversationId}`}
                                style={{
                                  textDecoration: 'none',
                                  color: '#111827',
                                  fontWeight: 800,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Konuşmaya Git →
                              </Link>
                            ) : (
                              <span style={{ color: '#6b7280' }}>Bağlı değil</span>
                            )}
                          </td>

                          <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                            <Link
                              href={`/orders/${row.id}`}
                              style={{
                                textDecoration: 'none',
                                color: '#111827',
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Detayı Aç →
                            </Link>
                          </td>

                          <td
                            style={{
                              padding: 14,
                              borderBottom: '1px solid #f3f4f6',
                              color: '#6b7280',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatDate(row.updatedAt || row.orderedAt || row.createdAt)}
                          </td>
                        </tr>
                      );
                    })}

                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={12} style={{ padding: 18, color: '#6b7280' }}>
                          Bu tenant için henüz sipariş kaydı görünmüyor.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
