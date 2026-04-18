import { AppShell } from '@/components/apparel-panel/AppShell';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 18,
  background: '#ffffff',
};

export default function ConversationDetailPage({
  params,
}: {
  params: { conversationId: string };
}) {
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
            Konuşma Detayı
          </h1>
          <p style={{ color: '#4b5563', margin: 0 }}>
            Bu ekran bir sonraki turda gerçek konuşma verisine bağlanacak.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <section style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Route parametresi
            </div>
            <div style={{ color: '#111827', fontWeight: 600 }}>
              conversationId: {decodeURIComponent(params.conversationId)}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Mesaj akışı alanı
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
              Burada inbound / outbound mesaj balonları, tarih bilgisi ve kanal içeriği
              gösterilecek.
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Ürün / bağlam alanı
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
              Aktif ürün bağlamı, AI cevap geçmişi, notlar ve manuel müdahale aksiyonları
              bu bölümde yer alacak.
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Medya ve kanıt alanı
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
              Hasarlı ürün fotoğrafı, video, sesli mesaj, PDF ve diğer müşteri medya
              kayıtları bu ekranda gösterilecek.
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
