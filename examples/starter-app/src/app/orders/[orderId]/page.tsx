'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { getOrderDetail } from '@/lib/apparel-panel/panel-relations';

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
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
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{value}</div>
      {helper ? (
        <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const rawOrderId = Array.isArray(params?.orderId) ? params.orderId[0] : params?.orderId;
  const orderId = rawOrderId || 'SIP-10428';

  const detail = getOrderDetail(orderId);

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
            href="/orders"
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
            ← Siparişlere dön
          </Link>

          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            Sipariş Detayı
          </h1>
          <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
            Sipariş, müşteri, ödeme, kargo ve bağlı operasyon akışını tek detay
            ekranında toplamak için hazırlanan v1 yapı.
          </p>
        </div>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#ffffff',
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Sipariş No</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
            {detail.id}
          </div>
          <div style={{ color: '#4b5563', lineHeight: 1.7 }}>{detail.note}</div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <MetricCard label="Müşteri" value={detail.customer} />
          <MetricCard label="Sipariş Durumu" value={detail.orderStatus} />
          <MetricCard label="Ödeme Durumu" value={detail.paymentStatus} />
          <MetricCard label="Kargo Durumu" value={detail.shipmentStatus} />
          <MetricCard label="Sonraki Aksiyon" value={detail.action} />
          <MetricCard label="Risk Seviyesi" value={detail.risk} />
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Bağlı Konuşma</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
              {detail.linkedConversation}
            </div>
            <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              Sipariş ekranından konuşma ekranına geçip müşteri iletişim akışını takip edebilirsin.
            </div>
            <Link
              href={detail.linkedConversationHref}
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
              Mesajlara Git
            </Link>
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
              Bağlı Operasyon Kaydı
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
              {detail.linkedCase}
            </div>
            <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              Siparişle ilişkili vaka varsa operasyon ekranından ilerleyebilirsin.
            </div>
            <Link
              href={detail.linkedCaseId ? `/operations/${detail.linkedCaseId}` : '/operations'}
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
              Operasyona Git
            </Link>
          </div>

          <MetricCard
            label="Son Güncelleme"
            value={detail.updatedAt}
            helper="Sipariş, ödeme ve operasyon alanlarındaki son hareket zamanı burada izlenecek."
          />
        </section>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#ffffff',
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            Bu Siparişte Operasyon Ekibi Ne Yönetecek?
          </div>

          <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
            <div>• Ödeme / dekont doğrulaması</div>
            <div>• Kargo ve teslimat takibi</div>
            <div>• Bağlı müşteri konuşmasının gözden geçirilmesi</div>
            <div>• Operasyon kaydı varsa onunla birlikte yönetim</div>
            <div>• İç not ve sorumlu atama alanı</div>
            <div>• Sipariş çözülene kadar aksiyon takibi</div>
          </div>
        </section>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#ffffff',
            padding: 18,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            Hızlı Geçişler
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/inbox"
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
              Mesajlara Git
            </Link>

            <Link
              href="/operations"
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
              Operasyonlara Git
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
