import { AppShell } from '@/components/apparel-panel/AppShell';

const INTEGRATION_CARDS = [
  {
    name: 'WhatsApp',
    category: 'Canlı müşteri mesajlaşma hattı',
    status: 'Kurulum gerekli',
    tone: 'warning' as const,
    summary:
      'Panel reply ve otomasyon zinciri hazır. Tenant seviyesinde gerçek WhatsApp hattı bağlandığında canlı kullanım tamamlanacak.',
    nextStep:
      'MIRELLE için fiziksel hat + Meta doğrulaması + wa_phone_number_id eşleştirmesi yapılmalı.',
  },
  {
    name: 'ikas',
    category: 'Mağaza / katalog / embedded app entegrasyonu',
    status: 'Aktif pilot',
    tone: 'success' as const,
    summary:
      'MIRELLE üzerinde embedded app, dashboard ve panel görünümü aktif pilot olarak çalışıyor.',
    nextStep:
      'Panel ekranları ürünleştirilirken katalog ve tenant görünümü bu entegrasyon üzerinden ilerliyor.',
  },
  {
    name: 'Meta Business',
    category: 'Çok kanallı kanal omurgası',
    status: 'Hazırlık aşaması',
    tone: 'info' as const,
    summary:
      'WhatsApp ve ileride Facebook tarafı için stratejik merkez olacak. Tenant bağlantı modeli burada netleşecek.',
    nextStep:
      'WhatsApp hattı bağlanınca Meta Business görünürlüğü ve health mantığı bu ekranda güçlendirilecek.',
  },
  {
    name: 'Facebook',
    category: 'Gelecek kanal adaptörü',
    status: 'Planlandı',
    tone: 'neutral' as const,
    summary:
      'Meta ekosistemi içinde daha sonraki çok kanallı inbox genişlemesinde değerlendirilecek.',
    nextStep:
      'WhatsApp hattı ve Meta Business akışı oturduktan sonra ikinci aşamada ele alınmalı.',
  },
  {
    name: 'Instagram',
    category: 'Gelecek kanal adaptörü',
    status: 'Planlandı',
    tone: 'neutral' as const,
    summary:
      'Çok kanallı mesaj merkezi vizyonunda yer alıyor ancak ilk satış sprintinde öncelik değil.',
    nextStep:
      'WhatsApp merkezli sürüm sabitlendikten sonra sıraya alınacak.',
  },
  {
    name: 'TikTok',
    category: 'İleri kanal backlog',
    status: 'Roadmap',
    tone: 'neutral' as const,
    summary:
      'Uzun vadeli kanal genişleme planında düşünülüyor. İlk dikey giyim ürünü satılabilir hale geldikten sonra değerlendirilmesi daha doğru.',
    nextStep:
      'Meta ve çok kanallı inbox fazı oturduktan sonra ayrıca teknik/ürün uygunluğu analiz edilmeli.',
  },
  {
    name: 'E-posta',
    category: 'Destek ve operasyon kanalı',
    status: 'Planlandı',
    tone: 'neutral' as const,
    summary:
      'Dekont, sipariş ve destek süreçlerinde ikincil kanal olarak değerli olabilir.',
    nextStep:
      'Operasyon ve sipariş ekranları daha olgun hale geldiğinde ikinci faza alınmalı.',
  },
];

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'neutral' | 'info';
}) {
  const styles =
    tone === 'success'
      ? { background: '#ecfdf5', color: '#065f46' }
      : tone === 'warning'
        ? { background: '#fffbeb', color: '#92400e' }
        : tone === 'info'
          ? { background: '#eff6ff', color: '#1d4ed8' }
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
  value: string;
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

function IntegrationCard({
  name,
  category,
  status,
  tone,
  summary,
  nextStep,
}: {
  name: string;
  category: string;
  status: string;
  tone: 'success' | 'warning' | 'neutral' | 'info';
  summary: string;
  nextStep: string;
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{name}</div>
        <Badge label={status} tone={tone} />
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#6b7280',
          marginBottom: 10,
        }}
      >
        {category}
      </div>

      <div
        style={{
          color: '#4b5563',
          lineHeight: 1.7,
          marginBottom: 12,
          fontSize: 14,
        }}
      >
        {summary}
      </div>

      <div
        style={{
          borderTop: '1px solid #f3f4f6',
          paddingTop: 10,
          color: '#374151',
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        <strong>Sonraki adım:</strong> {nextStep}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
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
              Entegrasyonlar
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Bu ekran müşteri firmanın hangi kanal ve platform bağlantılarının aktif,
              hangilerinin eksik, hangilerinin sıradaki yatırım alanı olduğunu kolayca
              anlaması için tasarlandı.
            </p>
          </div>

          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              background: '#ffffff',
              padding: 14,
              color: '#6b7280',
              maxWidth: 340,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            İlk satış sprintinde öncelik WhatsApp + ikas + giyim operasyon paneli.
            Meta Business, Facebook ve TikTok görünürlüğü bu yüzden burada stratejik
            alan olarak yer alıyor.
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
          <MetricCard
            label="Aktif Pilot"
            value="2"
            helper="ikas ve panel altyapısında görünür çalışan ana yüzeyler."
          />
          <MetricCard
            label="Kurulum Bekleyen"
            value="1"
            helper="Canlı WhatsApp tenant bağlantısı henüz tamamlanmadı."
          />
          <MetricCard
            label="Planlı Kanal"
            value="3+"
            helper="Meta Business, Facebook, Instagram, TikTok ve e-posta genişlemesi."
          />
          <MetricCard
            label="Bu Mağaza İçin Sonraki Adım"
            value="WhatsApp"
            helper="Fiziksel hat + Meta doğrulaması + tenant eşleştirmesi."
          />
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)',
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
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
              Entegrasyon Kartları
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 12,
              }}
            >
              {INTEGRATION_CARDS.map((item) => (
                <IntegrationCard
                  key={item.name}
                  name={item.name}
                  category={item.category}
                  status={item.status}
                  tone={item.tone}
                  summary={item.summary}
                  nextStep={item.nextStep}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                background: '#ffffff',
                padding: 18,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                Bu Mağaza İçin Öncelikli Aksiyonlar
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div
                  style={{
                    border: '1px solid #fde68a',
                    borderRadius: 14,
                    background: '#fffbeb',
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
                    1. WhatsApp hattını bağla
                  </div>
                  <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
                    Fiziksel hat geldikten sonra Meta doğrulaması yapılacak ve tenant
                    seviyesinde canlı panel reply testine geçilecek.
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 14,
                    background: '#ffffff',
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                    2. Meta Business görünümünü netleştir
                  </div>
                  <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
                    WhatsApp hattı oturduktan sonra Meta Business katmanı bu sayfada daha
                    görünür hale getirilecek.
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 14,
                    background: '#ffffff',
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                    3. Çok kanallı genişleme sırasını koru
                  </div>
                  <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
                    Önce WhatsApp ve giyim ürünü satılabilir hale gelecek. Facebook,
                    Instagram, e-posta ve TikTok bundan sonra sıraya alınacak.
                  </div>
                </div>
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
                Kanal Stratejisi
              </div>

              <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
                <div>• İlk öncelik: WhatsApp merkezli canlı operasyon</div>
                <div>• Pilot mağaza yüzeyi: ikas embedded app</div>
                <div>• Stratejik omurga: Meta Business görünürlüğü</div>
                <div>• Sonraki genişleme: Facebook / Instagram / e-posta</div>
                <div>• İleri roadmap: TikTok ve diğer kanal adaptörleri</div>
              </div>
            </section>
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
            Bu Sayfanın V1 Mantığı
          </div>

          <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
            <div>
              Bu ekran kullanıcıya sadece “hangi entegrasyon var” demiyor; aynı zamanda
              “hangi entegrasyon şimdi önemli, hangisi daha sonra gelecek” mantığını da
              anlatıyor.
            </div>
            <div>
              Böylece müşteri firma paneli açtığında teknik detaylara boğulmadan, mevcut
              kapasiteyi ve sıradaki adımı sade şekilde anlayabiliyor.
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
