'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { AppShell } from '@/components/apparel-panel/AppShell';
import type {
  CatalogHealthResponse,
  DashboardSummaryResponse,
  PoliciesContactResponse,
  ProductsListResponse,
  VariantsListResponse,
} from '@/lib/apparel-panel/types';
import { SectionCard } from '@/components/apparel-panel/SectionCard';
import { MetricCard } from '@/components/apparel-panel/MetricCard';
import { StatusBadge } from '@/components/apparel-panel/StatusBadge';

type QueueWriteResponse = {
  ok: boolean;
  fetchedAt?: string;
  runId?: string | null;
  sourceName?: string | null;
  queuedCount?: number;
  queuedExternalProductIds?: string[];
  error?: string;
};

type FocusItem = {
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
};

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function truncateText(value: string | null | undefined, max = 80) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + '...';
}

function getSyncTone(
  status: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'neutral' {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'success') return 'success';
  if (normalized === 'running' || normalized === 'processing') return 'warning';
  if (
    normalized === 'failed' ||
    normalized === 'error' ||
    normalized === 'cancelled'
  ) {
    return 'danger';
  }

  return 'neutral';
}

function getBoolTone(value: boolean): 'success' | 'danger' {
  return value ? 'success' : 'danger';
}

function mapConnectionLabel(value: boolean): string {
  return value ? 'Bağlı' : 'Bağlı değil';
}

function mapSyncStatusLabel(status: string | null | undefined): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'success') return 'Başarılı';
  if (normalized === 'running' || normalized === 'processing') return 'Çalışıyor';
  if (
    normalized === 'failed' ||
    normalized === 'error' ||
    normalized === 'cancelled'
  ) {
    return 'Hata';
  }

  return status || 'Bilinmiyor';
}

function FocusCard({ item }: { item: FocusItem }) {
  const styles =
    item.tone === 'success'
      ? {
          border: '1px solid #bbf7d0',
          background: '#f0fdf4',
          titleColor: '#166534',
        }
      : item.tone === 'warning'
        ? {
            border: '1px solid #fde68a',
            background: '#fffbeb',
            titleColor: '#92400e',
          }
        : item.tone === 'danger'
          ? {
              border: '1px solid #fecaca',
              background: '#fef2f2',
              titleColor: '#991b1b',
            }
          : item.tone === 'info'
            ? {
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                titleColor: '#1d4ed8',
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
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: styles.titleColor,
          marginBottom: 8,
        }}
      >
        {item.title}
      </div>

      <div
        style={{
          color: '#4b5563',
          lineHeight: 1.7,
          marginBottom: 12,
          fontSize: 14,
        }}
      >
        {item.detail}
      </div>

      <Link
        href={item.href}
        style={{
          textDecoration: 'none',
          display: 'inline-flex',
          borderRadius: 12,
          padding: '9px 13px',
          background: '#111827',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {item.cta}
      </Link>
    </div>
  );
}

function WorkspaceCard({
  href,
  title,
  description,
  helper,
}: {
  href: string;
  title: string;
  description: string;
  helper: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        background: '#ffffff',
        padding: 16,
        display: 'block',
        color: '#111827',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 10, fontSize: 14 }}>
        {description}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>{helper}</div>
    </Link>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummaryResponse | null>(null);
  const [catalogHealth, setCatalogHealth] = useState<CatalogHealthResponse | null>(null);
  const [products, setProducts] = useState<ProductsListResponse | null>(null);
  const [variants, setVariants] = useState<VariantsListResponse | null>(null);
  const [policiesContact, setPoliciesContact] =
    useState<PoliciesContactResponse | null>(null);

  const [queueWrite, setQueueWrite] = useState<QueueWriteResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const iframeToken = await TokenHelpers.getTokenForIframeApp();

        if (!iframeToken) {
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

          setPoliciesContact({
            ok: false,
            fetchedAt,
            tenant: null,
            policies: {
              shipping: null,
              delivery: null,
              return: null,
              exchange: null,
              support: null,
              contact: null,
            },
            contactChannels: [],
            error: 'iFrame JWT token alınamadı.',
          });

          return;
        }

        const headers = {
          Authorization: 'JWT ' + iframeToken,
        };

        const [
          dashboardRes,
          catalogHealthRes,
          productsRes,
          variantsRes,
          policiesContactRes,
        ] = await Promise.all([
          fetch('/api/apparel/dashboard-summary', {
            cache: 'no-store',
            headers,
          }),
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
          fetch('/api/apparel/policies-contact', {
            cache: 'no-store',
            headers,
          }),
        ]);

        const [
          dashboardRaw,
          catalogHealthRaw,
          productsRaw,
          variantsRaw,
          policiesContactRaw,
        ] = await Promise.all([
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
        const message =
          error instanceof Error ? error.message : 'Unknown error';

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

        setPoliciesContact({
          ok: false,
          fetchedAt,
          tenant: null,
          policies: {
            shipping: null,
            delivery: null,
            return: null,
            exchange: null,
            support: null,
            contact: null,
          },
          contactChannels: [],
          error: message,
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const handleQueueWrite = async () => {
    try {
      setQueueLoading(true);
      setQueueWrite(null);

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setQueueWrite({
          ok: false,
          runId: null,
          sourceName: null,
          queuedCount: 0,
          queuedExternalProductIds: [],
          error: 'iFrame JWT token alınamadı.',
        });
        return;
      }

      const response = await fetch('/api/ikas/sync-products-to-queue', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
        },
      });

      const rawText = await response.text();
      let raw: any = {};

      try {
        raw = rawText ? JSON.parse(rawText) : {};
      } catch {
        raw = {
          ok: false,
          error: rawText || `HTTP ${response.status} ${response.statusText}`,
        };
      }

      setQueueWrite({
        ok: !!raw?.ok && response.ok,
        fetchedAt: raw?.fetchedAt,
        runId: raw?.runId ?? null,
        sourceName: raw?.sourceName ?? null,
        queuedCount: raw?.queuedCount ?? 0,
        queuedExternalProductIds: Array.isArray(raw?.queuedExternalProductIds)
          ? raw.queuedExternalProductIds
          : [],
        error:
          raw?.error ||
          (!response.ok ? `HTTP ${response.status} ${response.statusText}` : undefined),
      });
    } catch (error) {
      setQueueWrite({
        ok: false,
        runId: null,
        sourceName: null,
        queuedCount: 0,
        queuedExternalProductIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setQueueLoading(false);
    }
  };

  const tenant =
    dashboard?.tenant ||
    catalogHealth?.tenant ||
    products?.tenant ||
    variants?.tenant ||
    policiesContact?.tenant ||
    null;

  const topError =
    dashboard?.error ||
    catalogHealth?.error ||
    products?.error ||
    variants?.error ||
    policiesContact?.error ||
    null;

  const workspaceCards = useMemo(
    () => [
      {
        href: '/inbox',
        title: 'Mesajlar',
        description: 'Müşteri konuşmalarını aç, operatör görünümünü kontrol et.',
        helper: tenant?.waPhoneNumberId
          ? 'WhatsApp hattı görünür durumda.'
          : 'WhatsApp hattı eksikse manuel reply kapalı kalır.',
      },
      {
        href: '/orders',
        title: 'Siparişler',
        description: 'Sipariş, ödeme ve kargo tarafını tek yerden izle.',
        helper: 'Sipariş detail ve operasyon bağı burada şekillenecek.',
      },
      {
        href: '/operations',
        title: 'Operasyonlar',
        description: 'Şikayet, hasarlı ürün ve dekont vakalarını yönet.',
        helper: 'Operasyon ekibinin ana çalışma alanı.',
      },
    ],
    [tenant?.waPhoneNumberId],
  );

  const focusItems = useMemo<FocusItem[]>(() => {
    const items: FocusItem[] = [];

    if (!tenant?.waPhoneNumberId) {
      items.push({
        title: 'WhatsApp hattı eksik',
        detail:
          'Bu mağaza için tenant seviyesinde WhatsApp hattı henüz görünmüyor. Manuel yanıt bu yüzden kapalı kalır.',
        href: '/integrations',
        cta: 'Entegrasyonları Aç',
        tone: 'warning',
      });
    }

    if (!dashboard?.ikasConnected) {
      items.push({
        title: 'ikas bağlantısı kontrol edilmeli',
        detail:
          'Mağaza bağlantısı pasif veya doğrulanmamış görünüyor. Katalog görünümü etkilenebilir.',
        href: '/integrations',
        cta: 'Bağlantıyı İncele',
        tone: 'warning',
      });
    } else {
      items.push({
        title: 'ikas pilot bağlantısı aktif',
        detail:
          'Mağaza ve katalog görünümü şu an aktif pilot bağlantı üstünden çalışıyor.',
        href: '/catalog',
        cta: 'Kataloğu Aç',
        tone: 'info',
      });
    }

    if ((dashboard?.latestSync?.errorCount ?? 0) > 0) {
      items.push({
        title: 'Sync uyarısı var',
        detail: `Son sync içinde ${dashboard?.latestSync?.errorCount ?? 0} hata kaydı görünüyor. Katalog tarafı gözden geçirilmeli.`,
        href: '/catalog',
        cta: 'Kataloğu Kontrol Et',
        tone: 'warning',
      });
    }

    if (items.length === 0) {
      items.push({
        title: 'Ana sistem dengeli görünüyor',
        detail:
          'Bağlantılar ve temel katalog sağlığı şu an kritik uyarı üretmiyor.',
        href: '/dashboard',
        cta: 'Dashboard’da Kal',
        tone: 'success',
      });
    }

    return items.slice(0, 3);
  }, [
    tenant?.waPhoneNumberId,
    dashboard?.ikasConnected,
    dashboard?.latestSync?.errorCount,
  ]);

  const topProducts = (products?.items || []).slice(0, 3);
  const topVariants = (variants?.items || []).slice(0, 3);

  return (
    <AppShell>
      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 20,
          minHeight: '100vh',
        }}
      >
        {loading ? (
          <div>Yükleniyor...</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <section
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                background: '#ffffff',
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: 0.45,
                  marginBottom: 8,
                }}
              >
                Ana Kontrol Merkezi
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: '#111827',
                  marginBottom: 10,
                  lineHeight: 1.2,
                }}
              >
                {tenant?.brandName || tenant?.storeName || 'Giyim Operasyon Dashboard'}
              </div>

              <div
                style={{
                  color: '#4b5563',
                  lineHeight: 1.8,
                  fontSize: 15,
                  marginBottom: 14,
                }}
              >
                Müşteri firmanın uygulamayı açtığında en hızlı şekilde yönünü bulacağı,
                mesaj, sipariş, operasyon ve bağlantı sağlığını tek yerden göreceği ana ekran.
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link
                  href="/inbox"
                  style={{
                    textDecoration: 'none',
                    borderRadius: 12,
                    padding: '10px 14px',
                    background: '#111827',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  Mesajlara Git
                </Link>

                <Link
                  href="/orders"
                  style={{
                    textDecoration: 'none',
                    borderRadius: 12,
                    padding: '10px 14px',
                    background: '#ffffff',
                    color: '#111827',
                    border: '1px solid #e5e7eb',
                    fontWeight: 700,
                  }}
                >
                  Siparişleri Aç
                </Link>

                <Link
                  href="/operations"
                  style={{
                    textDecoration: 'none',
                    borderRadius: 12,
                    padding: '10px 14px',
                    background: '#ffffff',
                    color: '#111827',
                    border: '1px solid #e5e7eb',
                    fontWeight: 700,
                  }}
                >
                  Operasyonları Aç
                </Link>
              </div>
            </section>

            {topError ? (
              <SectionCard title="Dashboard Uyarısı" subtitle="Ana veri yüzeyinde hata algılandı.">
                <div
                  style={{
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#991b1b',
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {topError}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard
              title="Hızlı Bağlantı Özeti"
              subtitle="Tenant ve mağaza seviyesindeki en kritik bağlantı görünümü."
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                <MetricCard
                  label="WhatsApp"
                  value={
                    <StatusBadge
                      label={tenant?.waPhoneNumberId ? 'Bağlı' : 'Eksik'}
                      tone={tenant?.waPhoneNumberId ? 'success' : 'danger'}
                    />
                  }
                />
                <MetricCard
                  label="ikas"
                  value={
                    <StatusBadge
                      label={mapConnectionLabel(Boolean(dashboard?.ikasConnected))}
                      tone={getBoolTone(Boolean(dashboard?.ikasConnected))}
                    />
                  }
                />
                <MetricCard
                  label="Son Sync"
                  value={
                    <StatusBadge
                      label={
                        dashboard?.latestSync?.status
                          ? mapSyncStatusLabel(dashboard.latestSync.status)
                          : 'Bilinmiyor'
                      }
                      tone={getSyncTone(dashboard?.latestSync?.status)}
                    />
                  }
                  helper={formatDate(dashboard?.latestSync?.finishedAt)}
                />
                <MetricCard
                  label="Marka"
                  value={tenant?.brandName || '-'}
                  helper={tenant?.merchantId || '-'}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Çalışma Alanları"
              subtitle="Kullanıcının panel içinde en hızlı yol bulmasını sağlayan ana giriş noktaları."
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                {workspaceCards.map((card) => (
                  <WorkspaceCard
                    key={card.href}
                    href={card.href}
                    title={card.title}
                    description={card.description}
                    helper={card.helper}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Bugün Öncelikli Konular"
              subtitle="Sistemin durumuna göre ilk bakılacak alanları özetler."
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 12,
                }}
              >
                {focusItems.map((item) => (
                  <FocusCard key={item.title} item={item} />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Hızlı Sağlık Özeti"
              subtitle="Katalog ve policy tarafının en temel metrikleri."
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                <MetricCard
                  label="Toplam Ürün"
                  value={catalogHealth?.productCountTotal ?? 0}
                  tone="default"
                />
                <MetricCard
                  label="Toplam Varyant"
                  value={catalogHealth?.variantCountTotal ?? 0}
                />
                <MetricCard
                  label="Stokta Varyant"
                  value={catalogHealth?.variantCountInStock ?? 0}
                  tone="success"
                />
                <MetricCard
                  label="Aktif Policy"
                  value={dashboard?.policyCount ?? 0}
                />
                <MetricCard
                  label="İletişim Kanalı"
                  value={dashboard?.contactChannelCount ?? 0}
                />
                <MetricCard
                  label="Sync Hata Sayısı"
                  value={dashboard?.latestSync?.errorCount ?? 0}
                  tone={
                    (dashboard?.latestSync?.errorCount ?? 0) > 0 ? 'warning' : 'success'
                  }
                />
              </div>
            </SectionCard>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 360px)',
                gap: 16,
              }}
            >
              <SectionCard
                title="Katalogtan Hızlı Örnekler"
                subtitle="Detay tablo yerine kısa ürün ve varyant önizlemesi."
              >
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        marginBottom: 10,
                        color: '#111827',
                      }}
                    >
                      Son Ürünler
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {topProducts.length ? (
                        topProducts.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              border: '1px solid #e5e7eb',
                              borderRadius: 14,
                              padding: 14,
                              background: '#ffffff',
                            }}
                          >
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>{item.name}</div>
                            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 6 }}>
                              {item.category || '-'} / {item.subcategory || '-'}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <StatusBadge
                                label={item.isActive ? 'Aktif' : 'Pasif'}
                                tone={item.isActive ? 'success' : 'danger'}
                              />
                              <StatusBadge
                                label={`${item.variantCount} varyant`}
                                tone="neutral"
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div
                          style={{
                            border: '1px dashed #d1d5db',
                            borderRadius: 12,
                            padding: 16,
                            color: '#6b7280',
                            background: '#fafafa',
                          }}
                        >
                          Ürün verisi görünmüyor.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        marginBottom: 10,
                        color: '#111827',
                      }}
                    >
                      Son Varyantlar
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {topVariants.length ? (
                        topVariants.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              border: '1px solid #e5e7eb',
                              borderRadius: 14,
                              padding: 14,
                              background: '#ffffff',
                            }}
                          >
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>
                              {item.productName}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 6 }}>
                              {item.color || '-'} / {item.size || '-'}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <StatusBadge label={`${item.stockQty} stok`} tone="neutral" />
                              <StatusBadge
                                label={item.stockStatus === 'in_stock' ? 'Stokta' : 'Kontrol'}
                                tone={item.stockStatus === 'in_stock' ? 'success' : 'warning'}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div
                          style={{
                            border: '1px dashed #d1d5db',
                            borderRadius: 12,
                            padding: 16,
                            color: '#6b7280',
                            background: '#fafafa',
                          }}
                        >
                          Varyant verisi görünmüyor.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Paneli Nasıl Kullanırım?"
                subtitle="İlk kez giren kullanıcı için kısa rehber."
              >
                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 14,
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>1. Mesajlar ile başla</div>
                    <div style={{ color: '#6b7280', lineHeight: 1.7 }}>
                      Müşteri konuşmalarını aç, gerekli durumlarda operatör görünümünü kullan.
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 14,
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>2. Siparişleri kontrol et</div>
                    <div style={{ color: '#6b7280', lineHeight: 1.7 }}>
                      Ödeme, kargo ve sipariş takibini aynı omurgada izle.
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 14,
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      3. Operasyon kayıtlarını yönet
                    </div>
                    <div style={{ color: '#6b7280', lineHeight: 1.7 }}>
                      Şikayet, hasarlı ürün ve dekont gibi vakaları operasyon merkezinde takip et.
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 14,
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      4. Katalog ve policy tarafını güncel tut
                    </div>
                    <div style={{ color: '#6b7280', lineHeight: 1.7 }}>
                      Ürün, varyant ve policy bilgileri güncel oldukça müşteri deneyimi güçlenir.
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Policy ve İletişim Özeti"
              subtitle="Tam detay yerine kısa görünüm."
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                <MetricCard
                  label="Policy Sayısı"
                  value={dashboard?.policyCount ?? 0}
                />
                <MetricCard
                  label="İletişim Kanalı"
                  value={dashboard?.contactChannelCount ?? 0}
                />
                <MetricCard
                  label="Destek Özeti"
                  value={truncateText(policiesContact?.policies.support, 70)}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    marginBottom: 10,
                    color: '#111827',
                  }}
                >
                  Öne Çıkan İletişim Kanalı
                </div>

                {(policiesContact?.contactChannels || []).length ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {policiesContact?.contactChannels.slice(0, 1).map((channel) => (
                      <div
                        key={channel.id}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 12,
                          padding: 14,
                          background: '#fafafa',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <StatusBadge
                            label={mapConnectionLabel(true)}
                            tone="success"
                          />
                          <StatusBadge
                            label={channel.isPrimary ? 'primary' : 'secondary'}
                            tone="neutral"
                          />
                        </div>

                        <div style={{ marginTop: 8, fontWeight: 700 }}>
                          {channel.label || 'İletişim'}
                        </div>

                        <div style={{ marginTop: 6, color: '#374151' }}>
                          {channel.displayValue || '-'}
                        </div>

                        <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                          {channel.availabilityText || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px dashed #d1d5db',
                      borderRadius: 12,
                      padding: 16,
                      color: '#6b7280',
                      background: '#fafafa',
                    }}
                  >
                    Aktif iletişim kanalı bulunamadı.
                  </div>
                )}
              </div>
            </SectionCard>

            <details
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                background: '#ffffff',
                padding: 16,
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 16,
                  color: '#111827',
                  outline: 'none',
                }}
              >
                Teknik Araçlar
              </summary>

              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <div style={{ color: '#6b7280', fontSize: 14 }}>
                  Bu alan iç kullanım ve entegrasyon testi için tutulur.
                </div>

                <div>
                  <button
                    onClick={handleQueueWrite}
                    disabled={queueLoading}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: '1px solid #d1d5db',
                      background: queueLoading ? '#e5e7eb' : '#111827',
                      color: queueLoading ? '#6b7280' : '#ffffff',
                      cursor: queueLoading ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {queueLoading ? 'Teknik test çalışıyor...' : 'Teknik kuyruk testini başlat'}
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                  }}
                >
                  <MetricCard
                    label="Teknik Durum"
                    value={
                      queueWrite ? (
                        <StatusBadge
                          label={queueWrite.ok ? 'Başarılı' : 'Hata'}
                          tone={queueWrite.ok ? 'success' : 'danger'}
                        />
                      ) : (
                        '-'
                      )
                    }
                  />
                  <MetricCard label="Çalıştırma Kimliği" value={queueWrite?.runId || '-'} />
                  <MetricCard
                    label="Kuyruğa Eklenen"
                    value={queueWrite?.queuedCount ?? 0}
                  />
                  <MetricCard
                    label="Kaynak Adı"
                    value={queueWrite?.sourceName || '-'}
                  />
                </div>

                {queueWrite?.fetchedAt ? (
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                      background: '#fafafa',
                      fontSize: 13,
                      color: '#374151',
                    }}
                  >
                    Son İstek Zamanı: {formatDate(queueWrite.fetchedAt)}
                  </div>
                ) : null}

                {queueWrite?.error ? (
                  <div
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: 12,
                      padding: 12,
                      background: '#fef2f2',
                      color: '#991b1b',
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    Hata Detayı: {queueWrite.error}
                  </div>
                ) : null}

                {queueWrite?.queuedExternalProductIds?.length ? (
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                      background: '#fafafa',
                      fontSize: 13,
                      color: '#374151',
                    }}
                  >
                    {queueWrite.queuedExternalProductIds.join(', ')}
                  </div>
                ) : null}
              </div>
            </details>
          </div>
        )}
      </main>
    </AppShell>
  );
}
