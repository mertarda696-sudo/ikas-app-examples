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

function mapStockStatusLabel(status: string | null | undefined): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'in_stock') return 'Stokta';
  if (normalized === 'out_of_stock') return 'Stokta yok';
  if (normalized === 'low_stock') return 'Stok az';

  return status || 'Bilinmiyor';
}

function mapChannelLabel(channel: string | null | undefined): string {
  const normalized = String(channel || '').toLowerCase();

  if (normalized === 'whatsapp') return 'WhatsApp';
  if (normalized === 'email') return 'E-posta';
  if (normalized === 'instagram') return 'Instagram';
  if (normalized === 'facebook') return 'Facebook';
  if (normalized === 'other') return 'İletişim';

  return channel || 'İletişim';
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
            label={mapStockStatusLabel(row.stockStatus)}
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
            label={row.isActive ? 'Aktif' : 'Pasif'}
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
            label={mapStockStatusLabel(row.stockStatus)}
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
            title='Mağaza ve Bağlantı Özeti'
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
                label='Marka'
                value={tenant?.brandName || '-'}
                helper={tenant?.tenantId || '-'}
              />
              <MetricCard
                label='Mağaza Adı'
                value={tenant?.storeName || '-'}
                helper={tenant?.sourcePlatform || '-'}
              />
              <MetricCard
                label='WhatsApp'
                value={tenant?.waPhoneNumberId || 'Henüz bağlı değil'}
                helper={
                  tenant?.waPhoneNumberId
                    ? 'Aktif kanal: WhatsApp'
                    : 'Bağlantı bilgisi henüz tanımlı değil'
                }
              />
              <MetricCard
                label='ikas Bağlantısı'
                value={
                  <StatusBadge
                    label={mapConnectionLabel(Boolean(dashboard?.ikasConnected))}
                    tone={getBoolTone(Boolean(dashboard?.ikasConnected))}
                  />
                }
              />
              <MetricCard
                label='Son Senkron'
                value={
                  dashboard?.latestSync?.status ? (
                    <StatusBadge
                      label={mapSyncStatusLabel(dashboard.latestSync.status)}
                      tone={getSyncTone(dashboard.latestSync.status)}
                    />
                  ) : (
                    '-'
                  )
                }
                helper={formatDate(dashboard?.latestSync?.finishedAt)}
              />
              <MetricCard
                label='Mağaza Kimliği'
                value={tenant?.merchantId || '-'}
              />
            </div>
          </SectionCard>

          <SectionCard
            title='Katalog Sağlığı'
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
                label='Son Senkron Hata Sayısı'
                value={dashboard?.latestSync?.errorCount ?? 0}
                tone={
                  (dashboard?.latestSync?.errorCount ?? 0) > 0 ? 'warning' : 'success'
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            title='Ürünler'
            subtitle='İlk 50 ürünün salt okunur görünümü.'
          >
            <SimpleDataTable
              columns={productColumns}
              rows={products?.items || []}
              emptyText='Henüz ürün verisi görünmüyor.'
            />
          </SectionCard>

          <SectionCard
            title='Varyantlar'
            subtitle='Giyim varyantları: SKU, renk, beden, fiyat ve stok.'
          >
            <SimpleDataTable
              columns={variantColumns}
              rows={variants?.items || []}
              emptyText='Henüz varyant verisi görünmüyor.'
            />
          </SectionCard>

          <SectionCard
            title='Politikalar ve İletişim'
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
                  label='Kargo'
                  value={policiesContact?.policies.shipping || '-'}
                />
                <MetricCard
                  label='Teslimat'
                  value={policiesContact?.policies.delivery || '-'}
                />
                <MetricCard
                  label='İade'
                  value={policiesContact?.policies.return || '-'}
                />
                <MetricCard
                  label='Değişim'
                  value={policiesContact?.policies.exchange || '-'}
                />
                <MetricCard
                  label='Destek'
                  value={policiesContact?.policies.support || '-'}
                />
                <MetricCard
                  label='İletişim'
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
                  İletişim Kanalları
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
                            label={mapChannelLabel(channel.channelKey)}
                            tone='neutral'
                          />
                          {channel.isPrimary ? (
                            <StatusBadge label='primary' tone='success' />
                          ) : null}
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
        label='Teknik Durum'
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
      <MetricCard label='Çalıştırma Kimliği' value={queueWrite?.runId || '-'} />
      <MetricCard
        label='Kuyruğa Eklenen'
        value={queueWrite?.queuedCount ?? 0}
      />
      <MetricCard
        label='Kaynak Adı'
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
