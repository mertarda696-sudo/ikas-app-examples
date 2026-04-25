'use client';

import Link from 'next/link';
import { OperatorActionSummaryBox } from '@/components/apparel-panel/OperatorActionSummaryBox';

function QuickRouteCard({
  href,
  title,
  description,
  helper,
  tone,
}: {
  href: string;
  title: string;
  description: string;
  helper: string;
  tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
}) {
  const borderColor =
    tone === 'danger'
      ? '#fecaca'
      : tone === 'warning'
        ? '#fde68a'
        : tone === 'success'
          ? '#bbf7d0'
          : tone === 'info'
            ? '#bfdbfe'
            : '#e5e7eb';

  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        background: '#ffffff',
        padding: 16,
        display: 'block',
        color: '#111827',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 8 }}>{title}</div>
      <div style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 10, fontSize: 14 }}>
        {description}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800 }}>{helper}</div>
    </Link>
  );
}

export function DashboardOperationsHub() {
  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <OperatorActionSummaryBox />

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              Panel Kontrol Yolları
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', marginBottom: 6 }}>
              Operasyon, CRM ve Kanıt alanlarına hızlı geçiş
            </div>
            <div style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7 }}>
              Dashboard artık sadece katalog/entegrasyon özeti değil; günlük operatör aksiyonlarını da öne çıkarır.
            </div>
          </div>
          <Link href="/operator-actions" style={{ textDecoration: 'none', borderRadius: 12, padding: '9px 13px', background: '#111827', color: '#ffffff', fontWeight: 900, fontSize: 13 }}>
            Aksiyon Merkezini Aç →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          <QuickRouteCard
            href="/operator-actions"
            title="Aksiyon Merkezi"
            description="Yanıt bekleyen konuşmaları, açık vakaları, CRM risklerini ve öncelikli takipleri tek özet halinde gösterir."
            helper="Operatörün günlük ilk bakacağı ekran."
            tone="warning"
          />
          <QuickRouteCard
            href="/operations"
            title="Operasyonlar"
            description="İade, kargo, sipariş destek, ödeme/dekont ve hasarlı ürün vakalarını canlı operasyon kuyruğunda yönetir."
            helper="Vaka durumlarını buradan takip et."
            tone="info"
          />
          <QuickRouteCard
            href="/evidence"
            title="Kanıtlar / Medya"
            description="Hasarlı ürün fotoğrafı, dekont, kargo paketi videosu ve iade/değişim kanıtları için operasyon zeminini hazırlar."
            helper="Medya/kanıt capability için v1 merkez."
            tone="danger"
          />
          <QuickRouteCard
            href="/inbox"
            title="Mesajlar"
            description="Müşteri konuşmalarını, CRM uyarılarını, manuel cevap akışını ve konuşma detaylarını takip eder."
            helper="WhatsApp operasyon ekranı."
            tone="success"
          />
        </div>
      </section>
    </section>
  );
}
