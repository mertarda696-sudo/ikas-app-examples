'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import type {
  CatalogHealthResponse,
  DashboardSummaryResponse,
  PoliciesContactResponse,
  ProductsListResponse,
  VariantsListResponse,
} from '@/lib/apparel-panel/types';

type HealthTone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

function StatusPill({ label, tone }: { label: string; tone: HealthTone }) {
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

function HealthMetricCard({ label, value, helper, tone }: { label: string; value: string | number; helper: string; tone: HealthTone }) {
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
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#111827' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function mapSyncStatus(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') return { label: 'Başarılı', tone: 'success' as const };
  if (normalized === 'running' || normalized === 'processing') return { label: 'Çalışıyor', tone: 'warning' as const };
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') return { label: 'Hata', tone: 'danger' as const };
  return { label: status || 'Bilinmiyor', tone: 'neutral' as const };
}

function truncateText(value: string | null | undefined, max = 90) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + '...';
}

export default function SystemHealthPage() {
  const [dashboard, setDashboard] = useState<DashboardSummaryResponse | null>(null);
  const [catalogHealth, setCatalogHealth] = useState<CatalogHealthResponse | null>(null);
  const [products, setProducts] = useState<ProductsListResponse | null>(null);
  const [variants, setVariants] = useState<VariantsListResponse | null>(null);
  const [policiesContact, setPoliciesContact] = useState<PoliciesContactResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const iframeToken = await TokenHelpers.getTokenForIframeApp();
        const fetchedAt = new Date().toISOString();

        if (!iframeToken) {
          const error = 'iFrame JWT token alınamadı.';
          setDashboard({ ok: false, fetchedAt, tenant: null, ikasConnected: false, productCount: 0, variantCount: 0, policyCount: 0, contactChannelCount: 0, latestSync: null, error });
          setCatalogHealth({ ok: false, fetchedAt, tenant: null, productCountTotal: 0, productCountActive: 0, variantCountTotal: 0, variantCountInStock: 0, variantCountPriced: 0, latestSync: null, error });
          setProducts({ ok: false, fetchedAt, tenant: null, items: [], error });
          setVariants({ ok: false, fetchedAt, tenant: null, items: [], error });
          setPoliciesContact({ ok: false, fetchedAt, tenant: null, policies: { shipping: null, delivery: null, return: null, exchange: null, support: null, contact: null }, contactChannels: [], error });
          return;
        }

        const headers = { Authorization: 'JWT ' + iframeToken };

        const [dashboardRes, catalogHealthRes, productsRes, variantsRes, policiesContactRes] = await Promise.all([
          fetch('/api/apparel/dashboard-summary', { cache: 'no-store', headers }),
          fetch('/api/apparel/catalog-health', { cache: 'no-store', headers }),
          fetch('/api/apparel/products', { cache: 'no-store', headers }),
          fetch('/api/apparel/variants', { cache: 'no-store', headers }),
          fetch('/api/apparel/policies-contact', { cache: 'no-store', headers }),
        ]);

        const [dashboardRaw, catalogHealthRaw, productsRaw, variantsRaw, policiesContactRaw] = await Promise.all([
          dashboardRes.json(),
          catalogHealthRes.json(),
          productsRes.json(),
          variantsRes.json(),
          policiesContactRes.json(),
        ]);

        setDashboard(dashboardRaw);
        setCatalogHealth(catalogHealthRaw);
        setProducts(productsRaw);
        setVariants(variantsRaw);
        setPoliciesContact(policiesContactRaw);
      } catch (error) {
        const fetchedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : 'Unknown error';
        setDashboard({ ok: false, fetchedAt, tenant: null, ikasConnected: false, productCount: 0, variantCount: 0, policyCount: 0, contactChannelCount: 0, latestSync: null, error: message });
        setCatalogHealth({ ok: false, fetchedAt, tenant: null, productCountTotal: 0, productCountActive: 0, variantCountTotal: 0, variantCountInStock: 0, variantCountPriced: 0, latestSync: null, error: message });
        setProducts({ ok: false, fetchedAt, tenant: null, items: [], error: message });
        setVariants({ ok: false, fetchedAt, tenant: null, items: [], error: message });
        setPoliciesContact({ ok: false, fetchedAt, tenant: null, policies: { shipping: null, delivery: null, return: null, exchange: null, support: null, contact: null }, contactChannels: [], error: message });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const tenant = dashboard?.tenant || catalogHealth?.tenant || products?.tenant || variants?.tenant || policiesContact?.tenant || null;
  const topError = dashboard?.error || catalogHealth?.error || products?.error || variants?.error || policiesContact?.error || null;
  const latestSync = dashboard?.latestSync || catalogHealth?.latestSync || null;
  const syncStatus = mapSyncStatus(latestSync?.status);

  const healthState = useMemo(() => {
    if (topError) return { label: 'Kontrol gerekli', tone: 'danger' as const, helper: 'Ana teknik veri yüzeylerinden en az biri hata döndürdü.' };
    if ((latestSync?.errorCount ?? 0) > 0) return { label: 'Sync uyarısı var', tone: 'warning' as const, helper: 'Son katalog/sync akışında hata sayısı sıfır değil.' };
    if (dashboard?.ikasConnected && tenant?.waPhoneNumberId) return { label: 'Operasyon için hazır', tone: 'success' as const, helper: 'ikas ve WhatsApp bağlantı sinyalleri olumlu görünüyor.' };
    return { label: 'Hazırlık izleniyor', tone: 'info' as const, helper: 'Bazı bağlantı veya canlı kullanım sinyalleri izleme aşamasında.' };
  }, [topError, latestSync?.errorCount, dashboard?.ikasConnected, tenant?.waPhoneNumberId]);

  const topProducts = products?.items?.slice(0, 4) || [];
  const topVariants = variants?.items?.slice(0, 4) || [];
  const primaryContact = policiesContact?.contactChannels?.[0] || null;

  return (
    <AppShell>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>
              Teknik İzleme Alanı
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111827', margin: '0 0 8px' }}>
              Sistem Sağlığı
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7, maxWidth: 780 }}>
              Katalog, varyant, policy, iletişim, ikas bağlantısı ve sync durumunu günlük dashboard’dan ayrı teknik izleme ekranında takip edin.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#111827', color: '#ffffff', fontWeight: 900 }}>
              Dashboard →
            </Link>
            <Link href="/catalog" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 900 }}>
              Katalog →
            </Link>
            <Link href="/integrations" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 900 }}>
              Entegrasyonlar →
            </Link>
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <InfoCard title="Genel Sağlık Durumu">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <StatusPill label={healthState.label} tone={healthState.tone} />
                <StatusPill label={dashboard?.ikasConnected ? 'ikas bağlı' : 'ikas kontrol edilmeli'} tone={dashboard?.ikasConnected ? 'success' : 'warning'} />
                <StatusPill label={tenant?.waPhoneNumberId ? 'WhatsApp tenantta görünür' : 'WhatsApp bekleniyor'} tone={tenant?.waPhoneNumberId ? 'success' : 'warning'} />
                <StatusPill label={`Sync: ${syncStatus.label}`} tone={syncStatus.tone} />
              </div>
              <div style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7 }}>{healthState.helper}</div>
              {topError ? (
                <div style={{ marginTop: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 13 }}>
                  {topError}
                </div>
              ) : null}
            </InfoCard>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              <HealthMetricCard label="Toplam Ürün" value={catalogHealth?.productCountTotal ?? dashboard?.productCount ?? 0} helper="Tenant kataloğundaki toplam ürün sayısı." tone="info" />
              <HealthMetricCard label="Aktif Ürün" value={catalogHealth?.productCountActive ?? 0} helper="Panelde aktif görünen ürün sayısı." tone="success" />
              <HealthMetricCard label="Toplam Varyant" value={catalogHealth?.variantCountTotal ?? dashboard?.variantCount ?? 0} helper="Ürün varyantlarının toplam sayısı." tone="info" />
              <HealthMetricCard label="Stokta Varyant" value={catalogHealth?.variantCountInStock ?? 0} helper="Stok sinyali olumlu olan varyantlar." tone={(catalogHealth?.variantCountInStock ?? 0) > 0 ? 'success' : 'warning'} />
              <HealthMetricCard label="Aktif Policy" value={dashboard?.policyCount ?? 0} helper="Policy/cevap kuralları için aktif kayıt sayısı." tone={(dashboard?.policyCount ?? 0) > 0 ? 'success' : 'warning'} />
              <HealthMetricCard label="İletişim Kanalı" value={dashboard?.contactChannelCount ?? 0} helper="Destek/iletişim için tanımlı kanal sayısı." tone={(dashboard?.contactChannelCount ?? 0) > 0 ? 'success' : 'warning'} />
              <HealthMetricCard label="Sync Hata" value={latestSync?.errorCount ?? 0} helper={`Son sync bitişi: ${formatDate(latestSync?.finishedAt)}`} tone={(latestSync?.errorCount ?? 0) > 0 ? 'danger' : 'success'} />
            </section>

            <InfoCard title="Katalog Önizlemesi">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, background: '#f9fafb' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#111827', marginBottom: 10 }}>Son Ürünler</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {topProducts.length > 0 ? topProducts.map((item) => (
                      <div key={item.id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
                        <div style={{ fontWeight: 900, color: '#111827' }}>{item.name}</div>
                        <div style={{ color: '#6b7280', fontSize: 13 }}>{item.category || '-'} / {item.subcategory || '-'}</div>
                        <div style={{ marginTop: 4 }}><StatusPill label={item.isActive ? 'Aktif' : 'Pasif'} tone={item.isActive ? 'success' : 'neutral'} /></div>
                      </div>
                    )) : <div style={{ color: '#6b7280', fontSize: 13 }}>Ürün önizlemesi yok.</div>}
                  </div>
                </div>

                <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, background: '#f9fafb' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#111827', marginBottom: 10 }}>Son Varyantlar</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {topVariants.length > 0 ? topVariants.map((item) => (
                      <div key={item.id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
                        <div style={{ fontWeight: 900, color: '#111827' }}>{item.productName}</div>
                        <div style={{ color: '#6b7280', fontSize: 13 }}>{item.color || '-'} / {item.size || '-'} · {item.stockQty} stok</div>
                        <div style={{ marginTop: 4 }}><StatusPill label={item.stockStatus || 'Stok bilgisi yok'} tone={item.stockStatus === 'in_stock' ? 'success' : 'neutral'} /></div>
                      </div>
                    )) : <div style={{ color: '#6b7280', fontSize: 13 }}>Varyant önizlemesi yok.</div>}
                  </div>
                </div>
              </div>
            </InfoCard>

            <InfoCard title="Policy ve İletişim Özeti">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <HealthMetricCard label="Policy Sayısı" value={dashboard?.policyCount ?? 0} helper="Kargo, iade, değişim ve destek cevapları için aktif kayıtlar." tone={(dashboard?.policyCount ?? 0) > 0 ? 'success' : 'warning'} />
                <HealthMetricCard label="İletişim Kanalı" value={dashboard?.contactChannelCount ?? 0} helper={primaryContact?.displayValue || primaryContact?.value || 'Birincil iletişim kanalı yok.'} tone={(dashboard?.contactChannelCount ?? 0) > 0 ? 'success' : 'warning'} />
              </div>

              <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 14, background: '#f9fafb', padding: 14, color: '#4b5563', lineHeight: 1.7, fontSize: 14 }}>
                <div><strong>Destek:</strong> {truncateText(policiesContact?.policies?.support, 180)}</div>
                <div><strong>İletişim:</strong> {truncateText(policiesContact?.policies?.contact, 180)}</div>
              </div>
            </InfoCard>
          </div>
        )}
      </main>
    </AppShell>
  );
}
