'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';

const CASE_DETAIL_MAP: Record<
  string,
  {
    title: string;
    type: string;
    customer: string;
    orderId: string;
    priority: string;
    status: string;
    assignee: string;
    media: string;
    updatedAt: string;
    summary: string;
    nextAction: string;
    channel: string;
  }
> = {
  'OP-301': {
    title: 'Kargo sonrası hasarlı ürün bildirimi',
    type: 'Hasarlı Ürün',
    customer: '905457464945',
    orderId: 'SIP-10428',
    priority: 'Yüksek',
    status: 'İnceleniyor',
    assignee: 'Operatör 1',
    media: 'Var',
    updatedAt: '15.04.2026 23:18',
    summary:
      'Bu kayıt hasarlı ürün vakalarının konuşma, sipariş ve medya/kanıt ile birlikte yönetileceği detail ekranını temsil eder.',
    nextAction: 'Müşteriden gelen medya/kanıtı kontrol et ve siparişle eşleştir',
    channel: 'WhatsApp',
  },
  'OP-302': {
    title: 'Teslimat gecikmesi şikayeti',
    type: 'Kargo Şikayeti',
    customer: '905457464945',
    orderId: 'SIP-10412',
    priority: 'Normal',
    status: 'Müşteri bekleniyor',
    assignee: 'Operatör 2',
    media: 'Yok',
    updatedAt: '15.04.2026 19:42',
    summary:
      'Bu kayıt kargo şikayetlerinde sipariş, konuşma geçmişi ve müşteri geri bildirimini tek yerde toplayacak yapıyı gösterir.',
    nextAction: 'Müşteriye güncel kargo durumu paylaşılmalı',
    channel: 'WhatsApp',
  },
  'OP-303': {
    title: 'Dekont doğrulama bekliyor',
    type: 'Ödeme / Dekont',
    customer: '9055•••',
    orderId: 'SIP-10387',
    priority: 'Kritik',
    status: 'Yeni',
    assignee: 'Finans Kuyruğu',
    media: 'Var',
    updatedAt: '15.04.2026 14:09',
    summary:
      'Bu kayıt ödeme/dekont vakalarının finans kontrolü, müşteri konuşması ve sipariş bağlantısıyla yönetileceği detail ekranını temsil eder.',
    nextAction: 'Dekont ve ödeme tutarı finans tarafından doğrulanmalı',
    channel: 'WhatsApp',
  },
  'OP-304': {
    title: 'Beden değişim talebi',
    type: 'İade / Değişim',
    customer: '9055•••',
    orderId: 'SIP-10374',
    priority: 'Normal',
    status: 'Çözüldü',
    assignee: 'Operatör 1',
    media: 'Yok',
    updatedAt: '14.04.2026 16:27',
    summary:
      'Bu kayıt iade ve değişim süreçlerinde durum takibi, iç not, müşteri konuşması ve sipariş bağlantısı için hazırlanmıştır.',
    nextAction: 'Beden değişim sonrası kapanış kontrolü yapılmalı',
    channel: 'WhatsApp',
  },
};

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

export default function OperationDetailPage() {
  const params = useParams<{ caseId: string }>();
  const rawCaseId = Array.isArray(params?.caseId) ? params.caseId[0] : params?.caseId;
  const caseId = rawCaseId || 'OP-301';

  const detail = CASE_DETAIL_MAP[caseId] || {
    title: 'Placeholder operasyon kaydı',
    type: 'Genel Şikayet',
    customer: 'Bilinmiyor',
    orderId: '-',
    priority: 'Normal',
    status: 'Yeni',
    assignee: 'Atanmadı',
    media: 'Yok',
    updatedAt: '-',
    summary: 'Bu vaka için placeholder detail ekranı gösteriliyor.',
    nextAction: 'Aksiyon bilgisi yok',
    channel: 'Belirsiz',
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
            href="/operations"
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
            ← Operasyonlara dön
          </Link>

          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            Operasyon Detayı
          </h1>
          <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
            Vaka, müşteri, sipariş, konuşma ve medya/kanıt ilişkisini tek ekranda
            toplamak için hazırlanan detail görünümü.
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
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Vaka No</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
            {caseId}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            {detail.title}
          </div>
          <div style={{ color: '#4b5563', lineHeight: 1.7 }}>{detail.summary}</div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <MetricCard label="Vaka Tipi" value={detail.type} />
<MetricCard label="Müşteri" value={detail.customer} />
<MetricCard label="Sipariş No" value={detail.orderId} />
<MetricCard label="Öncelik" value={detail.priority} />
<MetricCard label="Kanal" value={detail.channel} />
<MetricCard label="Sonraki Aksiyon" value={detail.nextAction} />
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <MetricCard
            label="Durum"
            value={detail.status}
            helper="Yeni, inceleniyor, müşteri bekleniyor, çözüldü ve kapatıldı akışları burada yönetilecek."
          />
          <MetricCard
            label="Sorumlu"
            value={detail.assignee}
            helper="Operatör veya ekip ataması detail seviyede burada tutulacak."
          />
          <MetricCard
            label="Medya / Kanıt"
            value={detail.media}
            helper="Fotoğraf, video, ses ve dekont gibi içerikler sonraki fazda bu kayda bağlanacak."
          />
          <MetricCard
            label="Son Güncelleme"
            value={detail.updatedAt}
            helper="Operasyon kaydındaki son hareket zamanı burada izlenecek."
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
            Bu Vaka İçinde Operasyon Ekibi Ne Yönetecek?
          </div>

          <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
  <div>• Müşteri konuşmasının gözden geçirilmesi</div>
  <div>• İlgili siparişle vaka ilişkisinin kontrolü</div>
  <div>• Medya / kanıt içeriğinin incelenmesi</div>
  <div>• Operatör iç notu ve sorumlu takibi</div>
  <div>• Öncelik ve durum güncellemesi</div>
  <div>• Vaka çözümü sonrası kapanış akışı</div>
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
              href="/orders"
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
              Siparişlere git
            </Link>

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
              Mesajlara git
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
