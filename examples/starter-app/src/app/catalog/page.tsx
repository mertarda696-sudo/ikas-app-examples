import Link from 'next/link';
import { AppShell } from '@/components/apparel-panel/AppShell';

const PRODUCT_ROWS = [
  {
    id: 'PRD-001',
    name: 'Kruvaze Blazer Ceket Taş',
    category: 'Ceket',
    variants: 4,
    stock: 'Stokta',
    price: '2.490 TL',
    sync: 'Güncel',
    updatedAt: '15.04.2026 23:10',
  },
  {
    id: 'PRD-002',
    name: 'Basic Fit Tişört Beyaz',
    category: 'Tişört',
    variants: 4,
    stock: 'Stokta',
    price: '690 TL',
    sync: 'Güncel',
    updatedAt: '15.04.2026 18:42',
  },
  {
    id: 'PRD-003',
    name: 'Taş Rengi Keten Pantolon',
    category: 'Pantolon',
    variants: 3,
    stock: 'Kontrol gerekli',
    price: '1.490 TL',
    sync: 'İnceleniyor',
    updatedAt: '14.04.2026 16:05',
  },
  {
    id: 'PRD-004',
    name: 'Oversize Gömlek Ekru',
    category: 'Gömlek',
    variants: 5,
    stock: 'Stokta',
    price: '1.150 TL',
    sync: 'Güncel',
    updatedAt: '14.04.2026 11:28',
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

export default function CatalogPage() {
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
              Katalog
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Ürünler, varyantlar, stok, fiyat ve senkron durumunun aynı yerden
              izlenmesi için hazırlanan katalog merkezi v1 ekranı.
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
            Bu ekran ilk aşamada ürünleşmiş placeholder verilerle ilerliyor.
            Sonraki fazda gerçek ürün, varyant ve sync kayıtları bu sayfaya bağlanacak.
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
            label="Toplam Ürün"
            value="8"
            helper="Katalogta görünen ana ürün sayısı."
          />
          <MetricCard
            label="Toplam Varyant"
            value="32"
            helper="Renk, beden ve diğer varyant toplamı."
          />
          <MetricCard
            label="Sync Uyarısı"
            value="2"
            helper="Kontrol veya doğrulama gerektiren kayıtlar."
          />
          <MetricCard
            label="Aktif Kaynak"
            value="ikas"
            helper="Mevcut pilot katalog kaynağı."
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
              Ürün Listesi
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 920,
                }}
              >
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {[
                      'Ürün',
                      'Kategori',
                      'Varyant',
                      'Stok',
                      'Fiyat',
                      'Sync',
                      'Son Güncelleme',
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
                  {PRODUCT_ROWS.map((row) => (
                    <tr key={row.id}>
                      <td
                        style={{
                          padding: 14,
                          borderBottom: '1px solid #f3f4f6',
                          fontWeight: 700,
                        }}
                      >
                        {row.name}
                      </td>
                      <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                        {row.category}
                      </td>
                      <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                        {row.variants}
                      </td>
                      <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                        <Badge
                          label={row.stock}
                          tone={row.stock === 'Stokta' ? 'success' : 'warning'}
                        />
                      </td>
                      <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                        {row.price}
                      </td>
                      <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                        <Badge
                          label={row.sync}
                          tone={row.sync === 'Güncel' ? 'info' : 'warning'}
                        />
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
                V1 Katalog Mantığı
              </div>

              <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
                <div>• Ürün / varyant görünümü tek yerde izlenecek</div>
                <div>• Sync durumu ve kaynak görünürlüğü eklenecek</div>
                <div>• Stok/fiyat değişiklikleri daha görünür olacak</div>
                <div>• Sonraki fazda gerçek catalog sync verisi bağlanacak</div>
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
                  href="/dashboard"
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
                  Dashboard
                </Link>

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
                  Siparişler
                </Link>

                <Link
                  href="/integrations"
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
                  Entegrasyonlar
                </Link>
              </div>
            </section>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
