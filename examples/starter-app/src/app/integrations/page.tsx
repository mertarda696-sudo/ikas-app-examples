import { AppShell } from '@/components/apparel-panel/AppShell';

const INTEGRATION_CARDS = [
  {
    name: 'WhatsApp',
    category: 'Canlı müşteri mesajlaşma hattı',
    status: 'Aktivasyon bekleniyor',
    tone: 'warning' as const,
    summary:
      'Panel reply, konuşma, sipariş ve operasyon yüzeyi hazır. Eksik halka tenant seviyesinde gerçek WhatsApp hattının bağlanması.',
    nextStep:
      'MIRELLE için fiziksel hat + Meta doğrulaması + doğru wa_phone_number_id eşleştirmesi yapılmalı.',
  },
  {
    name: 'ikas',
    category: 'Mağaza / katalog / embedded app entegrasyonu',
    status: 'Aktif pilot',
    tone: 'success' as const,
    summary:
      'MIRELLE üzerinde embedded app, dashboard ve panel görünümü aktif pilot olarak çalışıyor.',
    nextStep:
      'WhatsApp hattı geldiğinde storefront + panel + konuşma akışı canlıya yakın doğrulanacak.',
  },
  {
    name: 'Meta Business',
    category: 'Çok kanallı kanal omurgası',
    status: 'Canlı hazırlık aşaması',
    tone: 'info' as const,
    summary:
      'WhatsApp aktivasyonu tamamlandığında çok kanallı omurganın ilk gerçek görünür katmanı olacak.',
    nextStep:
      'Önce WhatsApp hattı oturtulmalı; ardından Meta health ve kanal görünürlüğü bu sayfada güçlendirilecek.',
  },
  {
    name: 'FLAW Sandbox',
    category: 'İkinci storefront / adapter deneme alanı',
    status: 'Sonraki faz',
    tone: 'neutral' as const,
    summary:
      'FLAW tenantı ayrı deneme alanı olarak korunmalı. İkinci website altyapısı burada test edilirse MIRELLE hattı karışmaz.',
    nextStep:
      'MIRELLE canlı aktivasyonu geçtikten sonra WooCommerce ile ikinci storefront sandbox açılması en mantıklı ilk adım olur.',
  },
  {
    name: 'Facebook / Instagram',
    category: 'Gelecek kanal adaptörleri',
    status: 'Planlandı',
    tone: 'neutral' as const,
    summary:
      'Çok kanallı mesaj merkezi vizyonunda yer alıyor ancak ilk satış sprintinde öncelik değil.',
    nextStep:
      'Önce WhatsApp merkezli sürüm stabil olmalı, sonra ikinci kanal fazına geçilmeli.',
  },
  {
    name: 'E-posta / TikTok',
    category: 'İleri kanal backlog',
    status: 'Roadmap',
    tone: 'neutral' as const,
    summary:
      'Destek, dekont ve içerik tabanlı genişleme için değerli olabilir ama şu anki canlı önceliği etkilememeli.',
    nextStep:
      'İlk canlı sprint ve storefront sandbox sonrası ayrıca değerlendirilmesi daha doğru.',
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

function ReadinessCard({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: 'warning' | 'success' | 'neutral';
}) {
  const styles =
    tone === 'warning'
      ? {
          border: '1px solid #fde68a',
          background: '#fffbeb',
          titleColor: '#92400e',
        }
      : tone === 'success'
        ? {
            border: '1px solid #bbf7d0',
            background: '#f0fdf4',
            titleColor: '#166534',
          }
        : {
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            titleColor: '#111827',
          };

  return (
    <div
      style={{
        border: styles.border,
        background: styles.background,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 800, color: styles.titleColor, marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#4b5563', lineHeight: 1.7 }}>{detail}</div>
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
              Bu ekran artık sadece hangi entegrasyon var bilgisini değil, canlıya çıkış için
              neyin hazır olduğunu ve sıradaki adımın ne olduğunu da net şekilde gösterir.
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
            Buradaki ana mantık: önce MIRELLE için WhatsApp aktivasyonu, sonra ilk canlı smoke test,
            ondan sonra FLAW üzerinde ikinci storefront sandbox.
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
            label="Canlı Öncelik"
            value="WhatsApp"
            helper="Şu anki en kritik aktivasyon alanı"
          />
          <MetricCard
            label="Pilot Altyapı"
            value="ikas"
            helper="Mağaza ve panel görünümü aktif pilot"
          />
          <MetricCard
            label="Hazırlık Modu"
            value="Go-Live"
            helper="Yarın tenant aktivasyonu ve smoke test odakta"
          />
          <MetricCard
            label="Sonraki Sandbox"
            value="FLAW"
            helper="İkinci storefront / adapter test alanı"
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
                Canlıya Çıkış Hazırlığı
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <ReadinessCard
                  title="1. Numara doğru tenant’a bağlanmalı"
                  detail="En kritik risk FLAW ve MIRELLE karışması. Bu yüzden önce tenant eşleşmesi doğrulanmalı."
                  tone="warning"
                />

                <ReadinessCard
                  title="2. Reply alanı otomatik açılmalı"
                  detail="WhatsApp hattı bağlandığında Mesajlar ve konuşma detail ekranında disabled state kalkmalı."
                  tone="neutral"
                />

                <ReadinessCard
                  title="3. İlk smoke test kısa ve kontrollü olmalı"
                  detail="Önce merhaba / ürün sorusu / kargo / dekont gibi temel senaryolar test edilecek."
                  tone="success"
                />
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
                Sonraki Sandbox Mantığı
              </div>

              <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
                <div>• MIRELLE = canlıya yakın tenant</div>
                <div>• FLAW = deney ve storefront sandbox tenantı</div>
                <div>• İlk storefront sandbox adayı = WooCommerce</div>
                <div>• Ticimax / IdeaSoft karşılaştırması ikinci aşamada daha doğru</div>
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
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            Yarın Numara Gelince Sıra Ne Olacak?
          </div>

          <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
            <div>• Önce numara ve Meta bağlantısı doğrulanacak</div>
            <div>• Sonra doğru tenant üzerinde WhatsApp alanı eşleştirilecek</div>
            <div>• Sonra panelde no-whatsapp guard kalktı mı bakılacak</div>
            <div>• Sonra inbound mesaj panelde görünüyor mu test edilecek</div>
            <div>• Sonra manual reply ve operasyon/sipariş navigation zinciri test edilecek</div>
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
            Bu Sayfanın Paket 13B Mantığı
          </div>

          <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
            <div>
              Bu ekran artık sadece “hangi entegrasyon var” demiyor; aynı zamanda
              “yarın canlıya en az sürprizle çıkmak için neye bakmalıyım” sorusuna cevap veriyor.
            </div>
            <div>
              Böylece müşteri firma teknik detaylar arasında kaybolmadan, mevcut hazırlık düzeyini
              ve sıradaki doğru adımı sade biçimde anlayabiliyor.
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
