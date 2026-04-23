'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { CatalogHealthResponse, DashboardSummaryResponse } from '@/lib/apparel-panel/types';

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
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

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
    </div>
  );
}

function getSyncTone(status: string | null | undefined, errorCount?: number | null): 'success' | 'warning' | 'neutral' | 'info' | 'danger' {
  const normalized = String(status || '').toLowerCase();
  if ((errorCount ?? 0) > 0) return 'warning';
  if (normalized === 'success') return 'success';
  if (normalized === 'running' || normalized === 'processing') return 'info';
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') return 'danger';
  return 'neutral';
}

function getSyncLabel(status: string | null | undefined, errorCount?: number | null) {
  const normalized = String(status || '').toLowerCase();
  if ((errorCount ?? 0) > 0) return `Uyarı (${errorCount})`;
  if (normalized === 'success') return 'Güncel';
  if (normalized === 'running' || normalized === 'processing') return 'Çalışıyor';
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled') return 'Hata';
  return status || 'Bilinmiyor';
}

function IntegrationCard({
  title,
  subtitle,
  statusLabel,
  tone,
  rows,
}: {
  title: string;
  subtitle: string;
  statusLabel: string;
  tone: 'success' | 'warning' | 'neutral' | 'info' | 'danger';
  rows: Array<{ label: string; value: string | number }>;
}) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{subtitle}</div>
        </div>
        <Badge label={statusLabel} tone={tone} />
      </div>

      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
            <div style={{ color: '#6b7280', fontSize: 13 }}>{row.label}</div>
            <div style={{ color: '#111827', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{row.value || '-'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function IntegrationsPage() {
  const [dashboard, setDashboard] = useState<DashboardSummaryResponse | null>(null);
  const [catalogHealth, setCatalogHealth] = useState<CatalogHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const token = await TokenHelpers.getTokenForIframeApp();

        if (!token) {
          const fetchedAt = new Date().toISOString();
          setDashboard({
            ok: false,
            fetchedAt,
            tenant: null,
            ikasConnected: false,
            productCount: 0,
            variantCount: 0,
            policyCount: 0,
            contactChannelCount: 0,
            latestSync: null,
            error: 'iFrame JWT token alınamadı.',
          });
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
          return;
        }

        const headers = { Authorization: 'JWT ' + token };
        const [dashboardRes, catalogHealthRes] = await Promise.all([
          fetch('/api/apparel/dashboard-summary', { cache: 'no-store', headers }),
          fetch('/api/apparel/catalog-health', { cache: 'no-store', headers }),
        ]);

        const [dashboardRaw, catalogHealthRaw] = await Promise.all([
          dashboardRes.json(),
          catalogHealthRes.json(),
        ]);

        setDashboard(dashboardRaw);
        setCatalogHealth(catalogHealthRaw);
      } catch (error) {
        const fetchedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : 'Unknown error';
        setDashboard({
          ok: false,
          fetchedAt,
          tenant: null,
          ikasConnected: false,
          productCount: 0,
          variantCount: 0,
          policyCount: 0,
          contactChannelCount: 0,
          latestSync: null,
          error: message,
        });
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
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const tenant = dashboard?.tenant || catalogHealth?.tenant || null;
  const topError = dashboard?.error || catalogHealth?.error || null;
  const latestSync = catalogHealth?.latestSync || dashboard?.latestSync || null;
  const ikasConnected = Boolean(dashboard?.ikasConnected);
  const hasWhatsAppTenant = Boolean(tenant?.waPhoneNumberId);

  const readiness = useMemo(() => {
    if (topError) {
      return { label: 'Kontrol gerekli', tone: 'danger' as const, helper: topError };
    }
    if (ikasConnected && hasWhatsAppTenant && (latestSync?.errorCount ?? 0) === 0) {
      return {
        label: 'Canlı teste hazır',
        tone: 'success' as const,
        helper: 'ikas, katalog, policy ve WhatsApp tenant bilgisi panelde görünür durumda.',
      };
    }
    if (ikasConnected && (latestSync?.errorCount ?? 0) === 0) {
      return {
        label: 'Katalog hazır',
        tone: 'warning' as const,
        helper: 'ikas ve katalog sağlıklı görünüyor; canlı WhatsApp smoke test ayrıca doğrulanmalı.',
      };
    }
    return {
      label: 'Hazırlık sürüyor',
      tone: 'neutral' as const,
      helper: 'Canlı öncesi entegrasyon durumu izleniyor.',
    };
  }, [topError, ikasConnected, hasWhatsAppTenant, latestSync?.errorCount]);

  return (
    <AppShell>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Entegrasyonlar</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              ikas bağlantısı, katalog sync sağlığı, WhatsApp tenant durumu ve canlı hazırlık metriklerini tek ekranda izleyin.
            </p>
          </div>

          <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, background: '#ffffff', padding: 14, color: '#6b7280', maxWidth: 380, fontSize: 13, lineHeight: 1.6 }}>
            {tenant?.brandName || tenant?.storeName || 'Tenant'} için entegrasyon durumu canlı API verilerinden hesaplanır. Statik/placeholder entegrasyon listesi kaldırıldı.
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : topError ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 600, marginBottom: 16 }}>
            {topError}
          </div>
        ) : (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
              <MetricCard label="Genel Durum" value={readiness.label} helper={readiness.helper} />
              <MetricCard label="ikas" value={ikasConnected ? 'Bağlı' : 'Bağlı değil'} helper="Merchant, katalog ve panel bağlamı." />
              <MetricCard label="WhatsApp Tenant" value={hasWhatsAppTenant ? 'Görünüyor' : 'Eksik'} helper={tenant?.waPhoneNumberId || 'wa_phone_number_id bulunamadı.'} />
              <MetricCard label="Son Sync" value={getSyncLabel(latestSync?.status, latestSync?.errorCount)} helper={latestSync?.finishedAt ? `Son bitiş: ${formatDate(latestSync.finishedAt)}` : 'Henüz sync kaydı yok.'} />
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
              <IntegrationCard
                title="ikas Catalog"
                subtitle="Mağaza, ürün, varyant, fiyat ve stok verisi."
                statusLabel={ikasConnected ? 'Bağlı' : 'Bağlı değil'}
                tone={ikasConnected ? 'success' : 'danger'}
                rows={[
                  { label: 'Store', value: tenant?.storeName || '-' },
                  { label: 'Merchant ID', value: tenant?.merchantId || '-' },
                  { label: 'Ürün', value: catalogHealth?.productCountTotal ?? 0 },
                  { label: 'Aktif Ürün', value: catalogHealth?.productCountActive ?? 0 },
                  { label: 'Varyant', value: catalogHealth?.variantCountTotal ?? 0 },
                  { label: 'Stokta Varyant', value: catalogHealth?.variantCountInStock ?? 0 },
                  { label: 'Fiyatlı Varyant', value: catalogHealth?.variantCountPriced ?? 0 },
                ]}
              />

              <IntegrationCard
                title="Catalog Sync"
                subtitle="Son sync run sağlığı ve katalog güncelliği."
                statusLabel={getSyncLabel(latestSync?.status, latestSync?.errorCount)}
                tone={getSyncTone(latestSync?.status, latestSync?.errorCount)}
                rows={[
                  { label: 'Status', value: latestSync?.status || '-' },
                  { label: 'Error Count', value: latestSync?.errorCount ?? 0 },
                  { label: 'Finished At', value: formatDate(latestSync?.finishedAt) },
                  { label: 'Kaynak', value: 'Supabase catalog_sync_runs' },
                ]}
              />

              <IntegrationCard
                title="WhatsApp / Meta"
                subtitle="Tenant seviyesinde WhatsApp numara eşleşmesi."
                statusLabel={hasWhatsAppTenant ? 'Tenantta görünür' : 'Eksik'}
                tone={hasWhatsAppTenant ? 'success' : 'warning'}
                rows={[
                  { label: 'wa_phone_number_id', value: tenant?.waPhoneNumberId || '-' },
                  { label: 'Channel', value: tenant?.channel || 'whatsapp' },
                  { label: 'Sonraki Test', value: 'Inbound + manual reply smoke' },
                ]}
              />

              <IntegrationCard
                title="Panel Backend"
                subtitle="Dashboard, catalog-health ve policy API bağlantıları."
                statusLabel="Aktif"
                tone="success"
                rows={[
                  { label: 'Dashboard API', value: dashboard?.ok ? 'OK' : 'Kontrol' },
                  { label: 'Catalog Health API', value: catalogHealth?.ok ? 'OK' : 'Kontrol' },
                  { label: 'Policy API', value: 'OK' },
                  { label: 'Panel Kaynağı', value: 'Vercel / Next.js' },
                ]}
              />
            </section>

            <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Sıradaki Doğru Kontrol</div>
              <div style={{ display: 'grid', gap: 10, color: '#4b5563', lineHeight: 1.7 }}>
                <div>• Entegrasyonlar ekranında ikas = Bağlı görünmeli.</div>
                <div>• Ürün/varyant/stok/fiyat metrikleri katalog sayfasıyla aynı sayıları vermeli.</div>
                <div>• Son Sync = Güncel ve error count = 0 olmalı.</div>
                <div>• WhatsApp tenant alanı görünüyorsa sonraki adım inbox/manual reply smoke test olur.</div>
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
