'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import CatalogSyncButton from '@/components/apparel-panel/CatalogSyncButton';
import type {
  CatalogHealthResponse,
  ProductsListResponse,
  VariantsListResponse,
} from '@/lib/apparel-panel/types';

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function formatPrice(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null) return '-';

  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency || 'TRY'}`;
  }
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'neutral' | 'info' | 'danger';
}) {
  const styles =
    tone === 'success'
      ? { background: '#ecfdf5', color: '#065f46' }
      : tone === 'warning'
        ? { background: '#fffbeb', color: '#92400e' }
        : tone === 'info'
          ? { background: '#eff6ff', color: '#1d4ed8' }
          : tone === 'danger'
            ? { background: '#fef2f2', color: '#991b1b' }
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
  value: string | number;
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

function mapStockTone(
  stockStatus: string | null | undefined,
  stockQty?: number | null,
): 'success' | 'warning' | 'neutral' | 'info' | 'danger' {
  const normalized = String(stockStatus || '').toLowerCase();

  if (normalized === 'in_stock' || (stockQty ?? 0) > 0) return 'success';
  if (normalized === 'out_of_stock') return 'danger';
  if (normalized === 'low_stock') return 'warning';

  return 'neutral';
}

function mapStockLabel(stockStatus: string | null | undefined, stockQty?: number | null) {
  const normalized = String(stockStatus || '').toLowerCase();

  if (normalized === 'in_stock' || (stockQty ?? 0) > 0) return 'Stokta';
  if (normalized === 'out_of_stock') return 'Stok yok';
  if (normalized === 'low_stock') return 'Düşük stok';

  return stockStatus || 'Bilinmiyor';
}

function mapSyncTone(
  status: string | null | undefined,
  errorCount?: number | null,
): 'success' | 'warning' | 'neutral' | 'info' | 'danger' {
  const normalized = String(status || '').toLowerCase();

  if ((errorCount ?? 0) > 0) return 'warning';
  if (normalized === 'success') return 'success';
  if (normalized === 'running' || normalized === 'processing') return 'info';
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') {
    return 'danger';
  }

  return 'neutral';
}

function mapSyncLabel(status: string | null | undefined, errorCount?: number | null) {
  const normalized = String(status || '').toLowerCase();

  if ((errorCount ?? 0) > 0) return `Uyarı (${errorCount})`;
  if (normalized === 'success') return 'Güncel';
  if (normalized === 'running' || normalized === 'processing') return 'Çalışıyor';
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') {
    return 'Hata';
  }

  return status || 'Bilinmiyor';
}

export default function CatalogPage() {
  const [catalogHealth, setCatalogHealth] = useState<CatalogHealthResponse | null>(null);
  const [products, setProducts] = useState<ProductsListResponse | null>(null);
  const [variants, setVariants] = useState<VariantsListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const iframeToken = await TokenHelpers.getTokenForIframeApp();

        if (!iframeToken) {
          const fetchedAt = new Date().toISOString();

          setCatalogHealth({
            ok: false,
            fetchedAt,
            tenant: null,
            productCountTotal: 0,
            productCountActive: 0,
            variantCountTotal: 0,
            variantCountInStock: 0,
            variantCountPriced: 0,
            latestSync: null,
            error: 'iFrame JWT token alınamadı.',
          });

          setProducts({
            ok: false,
            fetchedAt,
            tenant: null,
            items: [],
            error: 'iFrame JWT token alınamadı.',
          });

          setVariants({
            ok: false,
            fetchedAt,
            tenant: null,
            items: [],
            error: 'iFrame JWT token alınamadı.',
          });

          return;
        }

        const headers = {
          Authorization: 'JWT ' + iframeToken,
        };

        const [catalogHealthRes, productsRes, variantsRes] = await Promise.all([
          fetch('/api/apparel/catalog-health', {
            cache: 'no-store',
            headers,
          }),
          fetch('/api/apparel/products', {
            cache: 'no-store',
            headers,
          }),
          fetch('/api/apparel/variants', {
            cache: 'no-store',
            headers,
          }),
        ]);

        const [catalogHealthRaw, productsRaw, variantsRaw] = await Promise.all([
          catalogHealthRes.json(),
          productsRes.json(),
          variantsRes.json(),
        ]);

        setCatalogHealth(catalogHealthRaw);
        setProducts(productsRaw);
        setVariants(variantsRaw);
      } catch (error) {
        const fetchedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : 'Unknown error';

        setCatalogHealth({
          ok: false,
          fetchedAt,
          tenant: null,
          productCountTotal: 0,
          productCountActive: 0,
          variantCountTotal: 0,
          variantCountInStock: 0,
          variantCountPriced: 0,
          latestSync: null,
          error: message,
        });

        setProducts({
          ok: false,
          fetchedAt,
          tenant: null,
          items: [],
          error: message,
        });

        setVariants({
          ok: false,
          fetchedAt,
          tenant: null,
          items: [],
          error: message,
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const tenant = catalogHealth?.tenant || products?.tenant || variants?.tenant || null;
  const topError = catalogHealth?.error || products?.error || variants?.error || null;
  const topVariants = useMemo(() => (variants?.items || []).slice(0, 6), [variants?.items]);

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
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Katalog</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Ürünler, varyantlar, stok, fiyat ve sync durumunu tek ekranda izleyin.
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
            {tenant?.brandName || tenant?.storeName || 'Tenant'} için gerçek katalog verisi
            bu ekranda gösterilir. Placeholder liste kaldırıldı.
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : topError ? (
          <div
            style={{
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 14,
              padding: 16,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            {topError}
          </div>
        ) : (
          <>
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
                value={catalogHealth?.productCountTotal ?? 0}
                helper="Bu tenant için görünen toplam ürün sayısı."
              />
              <MetricCard
                label="Aktif Ürün"
                value={catalogHealth?.productCountActive ?? 0}
                helper="Aktif durumda olan ürün sayısı."
              />
              <MetricCard
                label="Toplam Varyant"
                value={catalogHealth?.variantCountTotal ?? 0}
                helper="Renk, beden ve diğer varyant toplamı."
              />
              <MetricCard
                label="Stokta Varyant"
                value={catalogHealth?.variantCountInStock ?? 0}
                helper="Stokta görünen varyant sayısı."
              />
              <MetricCard
                label="Fiyatlı Varyant"
                value={catalogHealth?.variantCountPriced ?? 0}
                helper="Fiyat bilgisi dolu olan varyant sayısı."
              />
              <MetricCard
                label="Son Sync"
                value={mapSyncLabel(
                  catalogHealth?.latestSync?.status,
                  catalogHealth?.latestSync?.errorCount,
                )}
                helper={
                  catalogHealth?.latestSync?.finishedAt
                    ? `Son bitiş: ${formatDate(catalogHealth.latestSync.finishedAt)}`
                    : 'Henüz sync kaydı görünmüyor.'
                }
              />
            </section>

            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)',
                gap: 16,
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
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Ürün Listesi</div>
                  <Badge
                    label={mapSyncLabel(
                      catalogHealth?.latestSync?.status,
                      catalogHealth?.latestSync?.errorCount,
                    )}
                    tone={mapSyncTone(
                      catalogHealth?.latestSync?.status,
                      catalogHealth?.latestSync?.errorCount,
                    )}
                  />
                </div>

                {(products?.items || []).length === 0 ? (
                  <div style={{ padding: 18, color: '#6b7280' }}>
                    Bu tenant için ürün görünmüyor.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        minWidth: 980,
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
                            'Aktif',
                            'Açıklama',
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
                        {(products?.items || []).map((row) => (
                          <tr key={row.id}>
                            <td
                              style={{
                                padding: 14,
                                borderBottom: '1px solid #f3f4f6',
                                fontWeight: 700,
                              }}
                            >
                              <div style={{ display: 'grid', gap: 4 }}>
                                <div>{row.name}</div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>
                                  {row.handle || '-'}
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                              {row.category || '-'} / {row.subcategory || '-'}
                            </td>

                            <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                              {row.variantCount}
                            </td>

                            <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                              <Badge
                                label={mapStockLabel(row.stockStatus)}
                                tone={mapStockTone(row.stockStatus)}
                              />
                            </td>

                            <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                              {formatPrice(row.basePrice, row.currency)}
                            </td>

                            <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                              <Badge
                                label={row.isActive ? 'Aktif' : 'Pasif'}
                                tone={row.isActive ? 'success' : 'neutral'}
                              />
                            </td>

                            <td
                              style={{
                                padding: 14,
                                borderBottom: '1px solid #f3f4f6',
                                color: '#6b7280',
                                maxWidth: 260,
                              }}
                            >
                              {row.shortDescription || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                    Son Varyantlar
                  </div>

                  {topVariants.length === 0 ? (
                    <div style={{ color: '#6b7280' }}>Varyant görünmüyor.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {topVariants.map((variant) => (
                        <div
                          key={variant.id}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: 14,
                            padding: 12,
                            background: '#f9fafb',
                          }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
                            {variant.productName}
                          </div>
                          <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                            Renk: {variant.color || '-'} · Beden: {variant.size || '-'}
                          </div>
                          <div
                            style={{
                              marginTop: 8,
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 8,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <Badge
                              label={mapStockLabel(variant.stockStatus, variant.stockQty)}
                              tone={mapStockTone(variant.stockStatus, variant.stockQty)}
                            />
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                              {formatPrice(variant.price, 'TRY')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                      Mesajlar
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
          </>
        )}
        <CatalogSyncButton />
      </main>
    </AppShell>
  );
}
