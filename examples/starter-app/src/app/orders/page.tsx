import Link from 'next/link';
import { AppShell } from '@/components/apparel-panel/AppShell';

const ORDER_ROWS = [
  {
    id: 'SIP-10428',
    customer: '905457464945',
    orderStatus: 'Hazırlanıyor',
    paymentStatus: 'Ödeme alındı',
    shipmentStatus: 'Kargoya hazırlanıyor',
    linkedConversation: 'Var',
    linkedCase: 'Yok',
    attention: 'Hazırlanıyor / yakın takip',
    updatedAt: '15.04.2026 23:10',
  },
  {
    id: 'SIP-10412',
    customer: '905457464945',
    orderStatus: 'Teslim edildi',
    paymentStatus: 'Ödeme alındı',
    shipmentStatus: 'Teslim edildi',
    linkedConversation: 'Var',
    linkedCase: 'Kargo şikayeti',
    attention: 'Kargo şikayeti bağlı',
    updatedAt: '14.04.2026 18:42',
  },
  {
    id: 'SIP-10387',
    customer: '9055•••',
    orderStatus: 'İnceleniyor',
    paymentStatus: 'Dekont kontrolü',
    shipmentStatus: 'Beklemede',
    linkedConversation: 'Var',
    linkedCase: 'Ödeme / Dekont',
    attention: 'Dekont kontrolü bekliyor',
    updatedAt: '13.04.2026 14:05',
  },
];

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'success' | 'warning';
}) {
  const styles =
    tone === 'success'
      ? { background: '#ecfdf5', color: '#065f46' }
      : tone === 'warning'
        ? { background: '#fffbeb', color: '#92400e' }
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

export default function OrdersPage() {
  return (
    <AppShell>
      <main
        style={{
          maxWidth: 1280,
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
              Siparişler
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Sipariş, ödeme, kargo ve bağlı konuşma / operasyon kayıtlarını tek
              yerde izlemek için hazırlanan v1 ekranı.
            </p>
          </div>

          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              background: '#ffffff',
              padding: 14,
              color: '#6b7280',
              maxWidth: 320,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Bu sayfa ilk aşamada placeholder veriyle detail akışını doğrulamak için
            hazırlandı. Sonraki fazda gerçek sipariş verisine bağlanacak.
          </div>
        </div>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Toplam Sipariş
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>124</div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Ödeme Kontrolü Bekleyen
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>7</div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Açık Operasyon Kaydı
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>11</div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Kargoda / Hazırlanan
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>19</div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.9fr)',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
              Sipariş Ekranının Mantığı
            </div>

            <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
              <div>
                Bu ekran sipariş, ödeme, kargo ve bağlı operasyon kayıtlarını tek
                omurgada görmek için hazırlanıyor.
              </div>
              <div>
                Kullanıcı önce hangi siparişe bakması gerektiğini burada anlayacak;
                ardından detail sayfasına geçip konuşma, operasyon ve ödeme/kargo
                bağlarını görecek.
              </div>
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
              Öncelikli İş Kuyruğu
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div
                style={{
                  border: '1px solid #fde68a',
                  borderRadius: 14,
                  background: '#fffbeb',
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
                  Dekont kontrolü bekleyen sipariş var
                </div>
                <div style={{ color: '#4b5563', lineHeight: 1.6 }}>
                  Önce ödeme doğrulaması gereken siparişler incelenmeli.
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 14,
                  background: '#ffffff',
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                  Operasyona bağlı siparişler görünür olmalı
                </div>
                <div style={{ color: '#4b5563', lineHeight: 1.6 }}>
                  Kargo şikayeti ve hasarlı ürün gibi vakalar sipariş detail ile birlikte
                  takip edilmeli.
                </div>
              </div>
            </div>
          </div>
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
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 1120,
              }}
            >
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {[
                    'Sipariş No',
                    'Müşteri',
                    'Sipariş Durumu',
                    'Ödeme',
                    'Kargo',
                    'Bağlı Konuşma',
                    'Açık Vaka',
                    'Öncelik / Not',
                    'Son Güncelleme',
                    'Detay',
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
                {ORDER_ROWS.map((row) => (
                  <tr key={row.id}>
                    <td
                      style={{
                        padding: 14,
                        borderBottom: '1px solid #f3f4f6',
                        fontWeight: 700,
                      }}
                    >
                      {row.id}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      {row.customer}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <StatusPill
                        label={row.orderStatus}
                        tone={row.orderStatus === 'Teslim edildi' ? 'success' : 'warning'}
                      />
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <StatusPill
                        label={row.paymentStatus}
                        tone={row.paymentStatus === 'Ödeme alındı' ? 'success' : 'warning'}
                      />
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <StatusPill
                        label={row.shipmentStatus}
                        tone={
                          row.shipmentStatus === 'Teslim edildi'
                            ? 'success'
                            : row.shipmentStatus === 'Beklemede'
                              ? 'neutral'
                              : 'warning'
                        }
                      />
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      {row.linkedConversation}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      {row.linkedCase}
                    </td>
                    <td
                      style={{
                        padding: 14,
                        borderBottom: '1px solid #f3f4f6',
                        color: '#374151',
                        fontWeight: 700,
                      }}
                    >
                      {row.attention}
                    </td>
                    <td
                      style={{
                        padding: 14,
                        borderBottom: '1px solid #f3f4f6',
                        color: '#6b7280',
                      }}
                    >
                      {row.updatedAt}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <Link
                        href={`/orders/${row.id}`}
                        style={{
                          textDecoration: 'none',
                          color: '#111827',
                          fontWeight: 700,
                        }}
                      >
                        Detayı Aç →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
