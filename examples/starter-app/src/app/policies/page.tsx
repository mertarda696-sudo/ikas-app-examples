import { AppShell } from '@/components/apparel-panel/AppShell';

const POLICY_ROWS = [
  {
    key: 'Kargo',
    summary: 'Sipariş sonrası gönderim, teslimat süresi ve kargo bilgilendirme metinleri.',
    status: 'Hazır',
    owner: 'Operasyon',
  },
  {
    key: 'İade',
    summary: 'İade koşulları, süre ve süreç beklentileri.',
    status: 'Hazır',
    owner: 'Operasyon',
  },
  {
    key: 'Değişim',
    summary: 'Beden / ürün değişim adımları ve müşteri yönlendirmesi.',
    status: 'Hazır',
    owner: 'Operasyon',
  },
  {
    key: 'Destek',
    summary: 'Müşteri destek saatleri ve dönüş beklentisi.',
    status: 'Hazır',
    owner: 'Müşteri Deneyimi',
  },
  {
    key: 'İletişim',
    summary: 'WhatsApp, e-posta ve diğer iletişim kanalları özeti.',
    status: 'Hazır',
    owner: 'Müşteri Deneyimi',
  },
  {
    key: 'Teslimat Notları',
    summary: 'Özel kargo/teslimat notları ve operasyon açıklamaları.',
    status: 'İnceleniyor',
    owner: 'Operasyon',
  },
];

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'neutral';
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

export default function PoliciesPage() {
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
              Politikalar
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Kargo, iade, değişim, destek ve iletişim içeriklerinin tek merkezde
              izlendiği policy görünümü v1.
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
            Bu sayfa sonraki fazda gerçek tenant policy kayıtlarını çekecek.
            Şu an ürünleşmiş bilgi mimarisi ve içerik blokları hazırlanıyor.
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
            label="Toplam Policy Bloğu"
            value="6"
            helper="Aktif policy başlığı sayısı."
          />
          <MetricCard
            label="Hazır İçerik"
            value="5"
            helper="Müşteriye gösterime hazır policy kayıtları."
          />
          <MetricCard
            label="İncelenen İçerik"
            value="1"
            helper="Revizyon veya netleştirme bekleyen kayıtlar."
          />
          <MetricCard
            label="İletişim Kanalları"
            value="1+"
            helper="WhatsApp ve diğer contact alanlarıyla ilişkili görünüm."
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
              Policy Kayıtları
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 860,
                }}
              >
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Başlık', 'Özet', 'Durum', 'Sorumlu'].map((header) => (
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
                  {POLICY_ROWS.map((row) => (
                    <tr key={row.key}>
                      <td
                        style={{
                          padding: 14,
                          borderBottom: '1px solid #f3f4f6',
                          fontWeight: 700,
                        }}
                      >
                        {row.key}
                      </td>
                      <td
                        style={{
                          padding: 14,
                          borderBottom: '1px solid #f3f4f6',
                          color: '#4b5563',
                          lineHeight: 1.6,
                        }}
                      >
                        {row.summary}
                      </td>
                      <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                        <Badge
                          label={row.status}
                          tone={row.status === 'Hazır' ? 'success' : 'warning'}
                        />
                      </td>
                      <td
                        style={{
                          padding: 14,
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        {row.owner}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                V1 Policy Mantığı
              </div>

              <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
                <div>• Kargo, iade ve değişim metinleri burada toplanacak</div>
                <div>• Destek ve iletişim içeriği ayrı bloklar halinde görülecek</div>
                <div>• Sonraki fazda tenant bazlı gerçek policy verisi bağlanacak</div>
                <div>• İçerik sahipliği ve revizyon durumu görünür kalacak</div>
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
                Not
              </div>

              <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
                Bu ekran düzenleme arayüzüne dönüşmeden önce içerik görünürlüğü, başlık
                mantığı ve tenant policy omurgasını kullanıcıya temiz göstermeyi
                hedefliyor.
              </div>
            </section>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
