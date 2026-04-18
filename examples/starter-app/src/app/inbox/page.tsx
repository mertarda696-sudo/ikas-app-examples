import Link from 'next/link';
import { AppShell } from '@/components/apparel-panel/AppShell';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 18,
  background: '#ffffff',
};

export default function InboxPage() {
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
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            Mesajlar
          </h1>
          <p style={{ color: '#4b5563', margin: 0 }}>
            İlk sürümde WhatsApp konuşma listesi ve konuşma detay ekranı burada yer alacak.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <section style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Inbox v1 kapsamı
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#4b5563', lineHeight: 1.7 }}>
              <li>Konuşma listesi</li>
              <li>Son mesaj ve zaman bilgisi</li>
              <li>Kanal bilgisi</li>
              <li>Açık / kapalı konuşma durumu</li>
              <li>Konuşma detay ekranına geçiş</li>
            </ul>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Sonraki faz
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
              Manuel cevap verme, medya/kanıt görünümü, hasarlı ürün video/fotoğrafları
              ve çok kanallı inbox bu yapının üstüne eklenecek.
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Konuşma detay ekranı iskeleti
            </div>
            <div style={{ color: '#4b5563', marginBottom: 12, lineHeight: 1.7 }}>
              Şimdilik boş route’u test etmek için örnek detay ekranı bağlantısı oluşturuyoruz.
            </div>

            <Link
              href="/inbox/demo-conversation"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                borderRadius: 10,
                padding: '10px 14px',
                background: '#111827',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              Örnek konuşma detayını aç
            </Link>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
