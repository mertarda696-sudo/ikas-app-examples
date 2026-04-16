'use client';

import { useEffect, useMemo, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
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
import {
  SimpleDataTable,
  type TableColumn,
} from '@/components/apparel-panel/SimpleDataTable';

type QueueWriteResponse = {
  ok: boolean;
  fetchedAt?: string;
  runId?: string | null;
  sourceName?: string | null;
  queuedCount?: number;
  queuedExternalProductIds?: string[];
  error?: string;
};

function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (value == null) return '-';

  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency || 'TRY'}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
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

      const raw = await response.json();

      setQueueWrite({
        ok: !!raw?.ok && response.ok,
        fetchedAt: raw?.fetchedAt,
        runId: raw?.runId ?? null,
        sourceName: raw?.sourceName ?? null,
        queuedCount: raw?.queuedCount ?? 0,
        queuedExternalProductIds: Array.isArray(raw?.queuedExternalProductIds)
          ? raw.queuedExternalProductIds
          : [],
        error: raw?.error,
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

  const productColumns = useMemo<TableColumn<NonNullable<ProductsListResponse['items']>[number]>[]>(
    () => [
      {
        key: 'name',
        header: 'Ürün',
        render: (row) => (
          <div>
            <div style={{ fontWeight: 700 }}>{row.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {row.handle || '-'}
            </div>
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Kategori',
        render: (row) => (
          <div>
            <div>{row.category || '-'}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {row.subcategory || '-'}
            </div>
          </div>
        ),
      },
      {
        key: 'price',
        header: 'Fiyat',
        render: (row) => formatMoney(row.basePrice, row.currency),
      },
      {
        key: 'variants',
        header: 'Varyant',
        align: 'center',
        render: (row) => row.variantCount,
      },
      {
        key: 'stock',
        header: 'Stok',
        render: (row) => (
          <StatusBadge
            label={row.stockStatus || 'unknown'}
            tone={
              row.stockStatus === 'in_stock'
                ? 'success'
                : row.stockStatus === 'out_of_stock'
                  ? 'danger'
                  : 'neutral'
            }
          />
        ),
      },
      {
        key: 'active',
        header: 'Aktif',
        render: (row) => (
          <StatusBadge
            label={row.isActive ? 'aktif' : 'pasif'}
            tone={row.isActive ? 'success' : 'danger'}
          />
        ),
      },
    ],
    [],
  );

  const variantColumns = useMemo<TableColumn<NonNullable<VariantsListResponse['items']>[number]>[]>(
    () => [
      {
        key: 'product',
        header: 'Ürün',
        render: (row) => row.productName,
      },
      {
        key: 'sku',
        header: 'SKU',
        render: (row) => row.sku || '-',
      },
      {
        key: 'color',
        header: 'Renk',
        render: (row) => row.color || '-',
      },
      {
        key: 'size',
        header: 'Beden',
        render: (row) => row.size || '-',
      },
      {
        key: 'price',
        header: 'Fiyat',
        render: (row) => formatMoney(row.price, 'TRY'),
      },
      {
        key: 'stockQty',
        header: 'Stok Adedi',
        align: 'center',
        render: (row) => row.stockQty,
      },
      {
        key: 'stockStatus',
        header: 'Stok Durumu',
        render: (row) => (
          <StatusBadge
            label={row.stockStatus || 'unknown'}
            tone={
              row.stockStatus === 'in_stock'
                ? 'success'
                : row.stockStatus === 'out_of_stock'
                  ? 'danger'
                  : 'neutral'
            }
          />
        ),
      },
    ],
    [],
  );

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

  return (
    <main
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: 24,
        background: '#f9fafb',
        minHeight: '100vh',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
          Giyim SaaS Paneli
        </h1>
        <p style={{ color: '#4b5563', margin: 0 }}>
          Tenant özeti, katalog sağlığı, ürün/varyant görünümü ve policy bilgileri
        </p>
      </div>

      {loading ? (
        <div>Yükleniyor...</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <SectionCard
            title='Store & Connection Summary'
            subtitle='Mağaza, kanal ve senkron durumunu tek ekranda özetler.'
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <MetricCard
                label='Brand / Tenant'
                value={tenant?.brandName || '-'}
                helper={tenant?.tenantId || '-'}
              />
              <MetricCard
                label='Store Name'
                value={tenant?.storeName || '-'}
                helper={tenant?.sourcePlatform || '-'}
              />
              <MetricCard
                label='WhatsApp'
                value={tenant?.waPhoneNumberId || '-'}
                helper='Aktif kanal: WhatsApp'
              />
              <MetricCard
                label='ikas Connection'
                value={
                  <StatusBadge
                    label={dashboard?.ikasConnected ? 'connected' : 'not connected'}
                    tone={getBoolTone(Boolean(dashboard?.ikasConnected))}
                  />
                }
              />
              <MetricCard
                label='Latest Sync'
                value={
                  dashboard?.latestSync?.status ? (
                    <StatusBadge
                      label={dashboard.latestSync.status}
                      tone={getSyncTone(dashboard.latestSync.status)}
                    />
                  ) : (
                    '-'
                  )
                }
                helper={formatDate(dashboard?.latestSync?.finishedAt)}
              />
              <MetricCard
                label='Merchant ID'
                value={tenant?.merchantId || '-'}
              />
            </div>
          </SectionCard>

          <SectionCard
            title='Catalog Health'
            subtitle='Ürün ve varyant yüzeyinin ne kadar dolu olduğunu gösterir.'
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              <MetricCard
                label='Toplam Ürün'
                value={catalogHealth?.productCountTotal ?? 0}
                tone='default'
              />
              <MetricCard
                label='Aktif Ürün'
                value={catalogHealth?.productCountActive ?? 0}
                tone='success'
              />
              <MetricCard
                label='Toplam Varyant'
                value={catalogHealth?.variantCountTotal ?? 0}
              />
              <MetricCard
                label='Stokta Varyant'
                value={catalogHealth?.variantCountInStock ?? 0}
                tone='success'
              />
              <MetricCard
                label='Fiyatı Dolu Varyant'
                value={catalogHealth?.variantCountPriced ?? 0}
                tone='success'
              />
              <MetricCard
                label='Aktif Policy'
                value={dashboard?.policyCount ?? 0}
              />
              <MetricCard
                label='İletişim Kanalı'
                value={dashboard?.contactChannelCount ?? 0}
              />
              <MetricCard
                label='Last Sync Error Count'
                value={dashboard?.latestSync?.errorCount ?? 0}
                tone={
                  (dashboard?.latestSync?.errorCount ?? 0) > 0 ? 'warning' : 'success'
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title='Products'
            subtitle='İlk 50 ürün read-only görünüm.'
          >
            <SimpleDataTable
              columns={productColumns}
              rows={products?.items || []}
              emptyText='Henüz ürün verisi görünmüyor.'
            />
          </SectionCard>

          <SectionCard
            title='Variants'
            subtitle='Giyim varyantları: SKU, renk, beden, fiyat ve stok.'
          >
            <SimpleDataTable
              columns={variantColumns}
              rows={variants?.items || []}
              emptyText='Henüz varyant verisi görünmüyor.'
            />
          </SectionCard>

          <SectionCard
            title='Policies & Contact'
            subtitle='Kargo, iade, değişim, destek ve iletişim özeti.'
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                <MetricCard
                  label='Shipping'
                  value={policiesContact?.policies.shipping || '-'}
                />
                <MetricCard
                  label='Delivery'
                  value={policiesContact?.policies.delivery || '-'}
                />
                <MetricCard
                  label='Return'
                  value={policiesContact?.policies.return || '-'}
                />
                <MetricCard
                  label='Exchange'
                  value={policiesContact?.policies.exchange || '-'}
                />
                <MetricCard
                  label='Support'
                  value={policiesContact?.policies.support || '-'}
                />
                <MetricCard
                  label='Contact'
                  value={policiesContact?.policies.contact || '-'}
                />
              </div>

              <div>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    marginBottom: 10,
                    color: '#111827',
                  }}
                >
                  Contact Channels
                </h3>

                {(policiesContact?.contactChannels || []).length ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {policiesContact?.contactChannels.map((channel) => (
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
                            label={channel.channelKey || 'channel'}
                            tone='neutral'
                          />
                          {channel.isPrimary ? (
                            <StatusBadge label='primary' tone='success' />
                          ) : null}
                        </div>

                        <div style={{ marginTop: 8, fontWeight: 700 }}>
                          {channel.label || '-'}
                        </div>

                        <div style={{ marginTop: 6, color: '#374151' }}>
                          {channel.displayValue || '-'}
                        </div>

                        <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                          {channel.availabilityText || '-'}
                        </div>

                        {channel.contactUrl ? (
                          <div style={{ marginTop: 6, fontSize: 13 }}>
                            {channel.contactUrl}
                          </div>
                        ) : null}
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
            </div>
          </SectionCard>

          <SectionCard
            title='Integration Tools'
            subtitle='Geçici admin/test araçları. İlk sürümde yalnızca queue write bırakıldı.'
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ color: '#6b7280', fontSize: 14 }}>
                Bu buton test amaçlı queue write çalıştırır. Üretim panelinde daha sonra
                ayrı admin araçları ekranına taşınabilir.
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
                  {queueLoading ? 'Queue write çalışıyor...' : 'Queue write testini başlat'}
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
                  label='Queue Status'
                  value={
                    queueWrite ? (
                      <StatusBadge
                        label={queueWrite.ok ? 'ok' : 'error'}
                        tone={queueWrite.ok ? 'success' : 'danger'}
                      />
                    ) : (
                      '-'
                    )
                  }
                />
                <MetricCard label='Run ID' value={queueWrite?.runId || '-'} />
                <MetricCard
                  label='Queued Count'
                  value={queueWrite?.queuedCount ?? 0}
                />
                <MetricCard
                  label='Source Name'
                  value={queueWrite?.sourceName || '-'}
                />
              </div>

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
          </SectionCard>

          {topError ? (
            <SectionCard title='Errors'>
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
        </div>
      )}
    </main>
  );
}
