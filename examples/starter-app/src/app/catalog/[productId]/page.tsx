'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { ProductListItem, ProductsListResponse, VariantListItem, VariantsListResponse } from '@/lib/apparel-panel/types';

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

function Badge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }) {
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
    <span style={{ display: 'inline-flex', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 900, ...styles }}>
      {label}
    </span>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18, minWidth: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr)', gap: 10, padding: '9px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
      <div style={{ color: '#6b7280', fontWeight: 900 }}>{label}</div>
      <div style={{ color: '#111827', lineHeight: 1.6, minWidth: 0, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function mapStockLabel(stockStatus: string | null | undefined, stockQty?: number | null) {
  const normalized = String(stockStatus || '').toLowerCase();

  if (normalized === 'in_stock' || (stockQty ?? 0) > 0) return 'Stokta';
  if (normalized === 'out_of_stock') return 'Stok yok';
  if (normalized === 'low_stock') return 'Düşük stok';

  return stockStatus || 'Bilinmiyor';
}

function mapStockTone(stockStatus: string | null | undefined, stockQty?: number | null): 'success' | 'warning' | 'neutral' | 'info' | 'danger' {
  const normalized = String(stockStatus || '').toLowerCase();

  if (normalized === 'in_stock' || (stockQty ?? 0) > 0) return 'success';
  if (normalized === 'out_of_stock') return 'danger';
  if (normalized === 'low_stock') return 'warning';

  return 'neutral';
}

function ProductNotFound({ productId }: { productId: string }) {
  return (
    <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, background: '#ffffff', padding: 20, color: '#6b7280' }}>
      Ürün bulunamadı: {productId}
    </div>
  );
}

export default function CatalogProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = Array.isArray(params?.productId) ? params.productId[0] : params?.productId;

  const [products, setProducts] = useState<ProductsListResponse | null>(null);
  const [variants, setVariants] = useState<VariantsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const iframeToken = await TokenHelpers.getTokenForIframeApp();
        if (!iframeToken) {
          setError('iFrame JWT token alınamadı.');
          return;
        }

        const headers = { Authorization: 'JWT ' + iframeToken };
        const [productsRes, variantsRes] = await Promise.all([
          fetch('/api/apparel/products', { cache: 'no-store', headers }),
          fetch('/api/apparel/variants', { cache: 'no-store', headers }),
        ]);

        const [productsRaw, variantsRaw] = await Promise.all([
          productsRes.json(),
          variantsRes.json(),
        ]);

        setProducts(productsRaw);
        setVariants(variantsRaw);

        if (productsRaw?.error || variantsRaw?.error) {
          setError(productsRaw?.error || variantsRaw?.error || 'Katalog verisi alınamadı.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const product: ProductListItem | null = useMemo(() => {
    const items = products?.items || [];
    return items.find((item) => item.id === productId || item.handle === productId) || null;
  }, [productId, products?.items]);

  const productVariants: VariantListItem[] = useMemo(() => {
    if (!product) return [];
    return (variants?.items || []).filter((variant) => variant.productId === product.id);
  }, [product, variants?.items]);

  const totalStock = useMemo(() => productVariants.reduce((sum, variant) => sum + (variant.stockQty || 0), 0), [productVariants]);
  const pricedVariantCount = useMemo(() => productVariants.filter((variant) => variant.price != null).length, [productVariants]);

  return (
    <AppShell>
      <main style={{ width: '100%', maxWidth: 1120, margin: '0 auto', padding: 24, minHeight: '100vh', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 18 }}>
          <Link href="/catalog" style={{ display: 'inline-block', textDecoration: 'none', borderRadius: 10, padding: '8px 12px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 900, marginBottom: 14 }}>
            ← Kataloğa dön
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 8px' }}>Ürün Detayı</h1>
              <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
                Ürün, varyant, fiyat, stok, renk ve beden bilgilerini tek ekranda kontrol edin.
              </p>
            </div>
            {product ? <Badge label={product.isActive ? 'Aktif' : 'Pasif'} tone={product.isActive ? 'success' : 'neutral'} /> : null}
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 800 }}>{error}</div>
        ) : !product ? (
          <ProductNotFound productId={String(productId || '-')} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, alignItems: 'start', minWidth: 0 }}>
            <InfoCard title="Ürün Özeti">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <Badge label={product.category || 'Kategori yok'} tone="info" />
                <Badge label={product.subcategory || 'Alt kategori yok'} tone="warning" />
                <Badge label={mapStockLabel(product.stockStatus, totalStock)} tone={mapStockTone(product.stockStatus, totalStock)} />
                <Badge label={`${product.variantCount} varyant`} tone="neutral" />
              </div>

              <div style={{ fontSize: 22, fontWeight: 900, color: '#111827', marginBottom: 8 }}>{product.name}</div>
              <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7 }}>{product.shortDescription || 'Açıklama bulunmuyor.'}</div>
            </InfoCard>

            <InfoCard title="Ürün Bilgileri">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0 18px' }}>
                <FieldRow label="Ürün ID" value={product.id} />
                <FieldRow label="Handle" value={product.handle || '-'} />
                <FieldRow label="Kategori" value={`${product.category || '-'} / ${product.subcategory || '-'}`} />
                <FieldRow label="Fiyat" value={formatPrice(product.basePrice, product.currency)} />
                <FieldRow label="Stok" value={mapStockLabel(product.stockStatus, totalStock)} />
                <FieldRow label="Toplam stok" value={totalStock} />
                <FieldRow label="Varyant" value={product.variantCount} />
                <FieldRow label="Fiyatlı varyant" value={pricedVariantCount} />
              </div>
            </InfoCard>

            <InfoCard title="Varyantlar">
              {productVariants.length === 0 ? (
                <div style={{ color: '#6b7280' }}>Bu ürün için varyant görünmüyor.</div>
              ) : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['SKU', 'Başlık', 'Renk', 'Beden', 'Stok', 'Fiyat', 'Aktif'].map((header) => (
                          <th key={header} style={{ textAlign: 'left', padding: 12, fontSize: 13, color: '#6b7280', fontWeight: 900, borderBottom: '1px solid #e5e7eb' }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {productVariants.map((variant) => (
                        <tr key={variant.id}>
                          <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6', fontWeight: 900, whiteSpace: 'nowrap' }}>{variant.sku || '-'}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>{variant.title || '-'}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>{variant.color || '-'}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>{variant.size || '-'}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
                            <Badge label={`${mapStockLabel(variant.stockStatus, variant.stockQty)} · ${variant.stockQty}`} tone={mapStockTone(variant.stockStatus, variant.stockQty)} />
                          </td>
                          <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>{formatPrice(variant.price, product.currency)}</td>
                          <td style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
                            <Badge label={variant.isActive ? 'Aktif' : 'Pasif'} tone={variant.isActive ? 'success' : 'neutral'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </InfoCard>

            <InfoCard title="Hızlı Geçişler">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/catalog" style={{ textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', fontWeight: 900 }}>Katalog Listesine Git →</Link>
                <Link href="/orders" style={{ textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', fontWeight: 900 }}>Siparişlere Git →</Link>
                <Link href="/inbox" style={{ textDecoration: 'none', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', fontWeight: 900 }}>Mesajlara Git →</Link>
              </div>
            </InfoCard>
          </div>
        )}
      </main>
    </AppShell>
  );
}
