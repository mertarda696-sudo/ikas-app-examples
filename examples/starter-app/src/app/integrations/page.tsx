import { AppShell } from '@/components/apparel-panel/AppShell';

const INTEGRATION_ROWS = [
  {
    name: 'WhatsApp',
    role: 'Müşteri mesajlaşma ve otomatik yanıt hattı',
    status: 'Kısmen hazır',
    detail: 'n8n webhook ve panel reply zinciri hazır; tenant bazlı canlı hat bağlantıları tenant seviyesinde tamamlanacak.',
  },
  {
    name: 'ikas',
    role: 'Mağaza / katalog / embedded app entegrasyonu',
    status: 'Aktif pilot',
    detail: 'MIRELLE üzerinde embedded app, dashboard ve panel görünümü çalışıyor.',
  },
  {
    name: 'Instagram',
    role: 'Gelecek kanal adaptörü',
    status: 'Planlandı',
    detail: 'Çok kanallı inbox fazında ele alınacak.',
  },
  {
    name: 'E-posta',
    role: 'Müşteri iletişim ve destek hattı',
    status: 'Planlandı',
    detail: 'Operasyon ve dekont akışları büyüdüğünde ikinci kanal olarak değerlendirilecek.',
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
              WhatsApp, ikas ve sonraki kanal/platform bağlantılarının tek merkezde
              izlendiği entegrasyon görünümü v1.
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
            Bu ekran ilk aşamada ürünleşmiş bağlantı görünümünü oluşturur. Sonraki
            fazda tenant bazlı gerçek bağlantı health bilgileri ve aksiyonlar eklenecek.
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
            helper="Şu an görünür ve çalışan ana bağlantı yüzeyleri."
          />
          <MetricCard
            label="Planlı Kanal"
            value="2+"
            helper="Sıradaki çok kanallı genişleme adayları."
          />
          <MetricCard
            label="Manuel Kurulum Gereken"
            value="1"
            helper="Tenant bazlı WhatsApp hat eşleştirmesi gerektiren alanlar."
          />
          <MetricCard
            label="Entegrasyon Merkezi"
            value="v1"
            helper="Bağlantı health ve yönlendirme ekranının ilk sürümü."
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
              Entegrasyon Durumu
            </div>

            <div style={{ display: 'grid' }}>
              {INTEGRATION_ROWS.map((row) => (
                <div
                  key={row.name}
                  style={{
                    padding: 18,
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>
                      {row.name}
                    </div>

                    <Badge
                      label={row.status}
                      tone={
                        row.status === 'Aktif pilot'
                          ? 'success'
                          : row.status === 'Kısmen hazır'
                            ? 'warning'
                            : 'neutral'
                      }
                    />
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      color: '#374151',
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    {row.role}
                  </div>

                  <div style={{ color: '#6b7280', lineHeight: 1.7 }}>{row.detail}</div>
                </div>
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
                V1 Entegrasyon Mantığı
              </div>

              <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
                <div>• Tenant bazlı WhatsApp bağlantı durumu görünür olacak</div>
                <div>• ikas pilot entegrasyon yüzeyi burada izlenecek</div>
                <div>• Sonraki fazda kanal health ve aksiyon blokları eklenecek</div>
                <div>• Instagram / e-posta gibi kanallar burada sıraya alınacak</div>
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
                Kritik Not
              </div>

              <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
                MIRELLE için gerçek canlı panel reply testinin tamamlanması, tenant
                seviyesinde WhatsApp hattı bağlanıp `wa_phone_number_id` alanı
                doldurulduğunda mümkün olacak.
              </div>
            </section>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
