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

type FocusItem = {
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
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

function truncateText(value: string | null | undefined, max = 110) {
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
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: styles.titleColor,
          marginBottom: 10,
        }}
      >
        {item.title}
      </div>

      <div
        style={{
          color: '#4b5563',
          lineHeight: 1.7,
          marginBottom: 14,
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
          padding: '10px 14px',
          background: '#111827',
          color: '#ffffff',
          fontWeight: 700,
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
        borderRadius: 18,
        background: '#ffffff',
        padding: 18,
        display: 'block',
        color: '#111827',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ color: '#4b5563', lineHeight: 1.7, marginBottom: 12 }}>
        {description}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 700 }}>{helper}</div>
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

  const productColumns = useMemo<
    TableColumn<NonNullable<ProductsListResponse['items']>[number]>[]
  >(
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

  const variantColumns = useMemo<
    TableColumn<NonNullable<VariantsListResponse['items']>[number]>[]
  >(
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

  const workspaceCards = useMemo(
    () => [
      {
        href: '/inbox',
        title: 'Mesajlar',
        description: 'Müşteri konuşmaları, operatör görünümü ve manuel yanıt akışı.',
        helper: tenant?.waPhoneNumberId
          ? 'WhatsApp hattı tanımlı, canlı iletişim akışı için hazır.'
          : 'WhatsApp hattı eksikse manuel reply kontrollü şekilde kapalı kalır.',
      },
      {
        href: '/orders',
        title: 'Siparişler',
        description: 'Sipariş, ödeme, kargo ve konuşma bağlantılarının tek ekranı.',
        helper: 'Sipariş detail ve operasyon bağı burada şekillenecek.',
      },
      {
        href: '/operations',
        title: 'Operasyonlar',
        description: 'Hasarlı ürün, dekont, iade ve şikayet kayıtlarının vaka merkezi.',
        helper: 'Operasyon ekibinin günlük çalışma alanı olarak konumlanıyor.',
      },
      {
        href: '/catalog',
        title: 'Katalog',
        description: 'Ürün, varyant, fiyat, stok ve sync sağlığının görünümü.',
        helper: `${catalogHealth?.productCountTotal ?? 0} ürün / ${
          catalogHealth?.variantCountTotal ?? 0
        } varyant görünür durumda.`,
      },
      {
        href: '/policies',
        title: 'Politikalar',
        description: 'Kargo, iade, değişim, destek ve iletişim içerikleri.',
        helper: `${dashboard?.policyCount ?? 0} policy / ${
          dashboard?.contactChannelCount ?? 0
        } iletişim kanalı özeti.`,
      },
      {
        href: '/integrations',
        title: 'Entegrasyonlar',
        description: 'WhatsApp, ikas ve sonraki kanal bağlantılarının merkezi.',
        helper: dashboard?.ikasConnected
          ? 'ikas pilot bağlantısı aktif görünüyor.'
          : 'ikas bağlantı health kontrolü gerekiyor.',
      },
    ],
    [tenant?.waPhoneNumberId, catalogHealth?.productCountTotal, catalogHealth?.variantCountTotal, dashboard?.policyCount, dashboard?.contactChannelCount, dashboard?.ikasConnected],
  );

  const focusItems = useMemo<FocusItem[]>(() => {
    const items: FocusItem[] = [];

    if (!tenant?.waPhoneNumberId) {
      items.push({
        title: 'WhatsApp hattı eksik',
        detail:
          'Bu tenant için WhatsApp hattı henüz bağlı değil. Mesaj detay ekranında manuel gönderim kontrollü olarak kapalı kalır.',
        href: '/integrations',
        cta: 'Entegrasyonları Aç',
        tone: 'warning',
      });
    } else {
      items.push({
        title: 'WhatsApp hattı hazır',
        detail:
          'Tenant seviyesinde WhatsApp hattı görünüyor. Mesajlar ekranı canlı operatör kullanımına daha yakın durumda.',
        href: '/inbox',
        cta: 'Mesajlara Git',
        tone: 'success',
      });
    }

    if (!dashboard?.ikasConnected) {
      items.push({
        title: 'ikas bağlantısı kontrol edilmeli',
        detail:
          'Mağaza bağlantısı pasif veya doğrulanmamış görünüyor. Ürün ve katalog görünümü etkilenebilir.',
        href: '/integrations',
        cta: 'Bağlantıyı İncele',
        tone: 'warning',
      });
    } else {
      items.push({
        title: 'ikas pilot bağlantısı aktif',
        detail:
          'Mağaza / katalog tarafı panel görünümü için aktif durumda. Katalog ve dashboard akışı kullanılabilir görünüyor.',
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

    if ((dashboard?.policyCount ?? 0) < 5) {
      items.push({
        title: 'Policy içeriği eksik olabilir',
        detail:
          'Kargo, iade, değişim veya destek içeriklerinden bazıları eksik görünüyor. Panelde policy görünümü tamamlanmalı.',
        href: '/policies',
        cta: 'Policy Alanını Aç',
        tone: 'warning',
      });
    }

    if ((dashboard?.contactChannelCount ?? 0) === 0) {
      items.push({
        title: 'İletişim kanalı görünmüyor',
        detail:
          'Müşteri iletişim yüzeyleri eksikse destek deneyimi zayıflar. Contact kanalları görünür ve güncel tutulmalı.',
        href: '/policies',
        cta: 'İletişim Alanına Git',
        tone: 'warning',
      });
    }

    if (items.length === 0) {
      items.push({
        title: 'Ana sistem dengeli görünüyor',
        detail:
          'Bağlantılar, policy yapısı ve temel katalog sağlığı şu an kritik uyarı üretmiyor.',
        href: '/dashboard',
        cta: 'Dashboard’da Kal',
        tone: 'success',
      });
    }

    return items;
  }, [
    tenant?.waPhoneNumberId,
    dashboard?.ikasConnected,
    dashboard?.latestSync?.errorCount,
    dashboard?.policyCount,
    dashboard?.contactChannelCount,
  ]);

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
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 0.9fr)',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <section
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 22,
              background: '#ffffff',
              padding: 22,
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

            <h1
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#111827',
                marginBottom: 10,
              }}
            >
              {tenant?.brandName || tenant?.storeName || 'Giyim Operasyon Dashboard'}
            </h1>

            <div
              style={{
                color: '#4b5563',
                lineHeight: 1.8,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              Müşteri firmanın uygulamayı açtığında en hızlı şekilde yönünü bulacağı,
              mesajlar, siparişler, operasyonlar, katalog ve bağlantı sağlığını tek
              yerden anlayacağı ana ekran.
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

              <Link
                href="/catalog"
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
                Kataloğu Aç
              </Link>
            </div>
          </section>

          <section
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 22,
              background: '#ffffff',
              padding: 22,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
              Hızlı Bağlantı Özeti
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#6b7280' }}>WhatsApp</span>
                <StatusBadge
                  label={tenant?.waPhoneNumberId ? 'Bağlı' : 'Eksik'}
                  tone={tenant?.waPhoneNumberId ? 'success' : 'danger'}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#6b7280' }}>ikas</span>
                <StatusBadge
                  label={mapConnectionLabel(Boolean(dashboard?.ikasConnected))}
                  tone={getBoolTone(Boolean(dashboard?.ikasConnected))}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#6b7280' }}>Son Sync</span>
                <StatusBadge
                  label={
                    dashboard?.latestSync?.status
                      ? mapSyncStatusLabel(dashboard.latestSync.status)
                      : 'Bilinmiyor'
                  }
                  tone={getSyncTone(dashboard?.latestSync?.status)}
                />
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid #f3f4f6',
                paddingTop: 12,
                color: '#6b7280',
                lineHeight: 1.7,
                fontSize: 13,
              }}
            >
              Son bitiş zamanı: {formatDate(dashboard?.latestSync?.finishedAt)}
            </div>
          </section>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
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
              title="Çalışma Alanları"
              subtitle="Müşteri firmanın panel içinde en hızlı yol bulmasını sağlayan ana giriş noktaları."
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
              subtitle="Sistemin şu anki durumuna göre kullanıcıya en doğru aksiyon yönünü gösterir."
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
              title="Mağaza ve Bağlantı Özeti"
              subtitle="Tenant, mağaza ve kanal seviyesindeki temel özet."
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                <MetricCard
                  label="Marka"
                  value={tenant?.brandName || '-'}
                  helper={tenant?.tenantId || '-'}
                />
                <MetricCard
                  label="Mağaza Adı"
                  value={tenant?.storeName || '-'}
                  helper={tenant?.sourcePlatform || '-'}
                />
                <MetricCard
                  label="WhatsApp"
                  value={tenant?.waPhoneNumberId || 'Henüz bağlı değil'}
                  helper={
                    tenant?.waPhoneNumberId
                      ? 'Aktif kanal: WhatsApp'
                      : 'Bağlantı henüz tenant üzerinde tanımlı değil'
                  }
                />
                <MetricCard
                  label="ikas Bağlantısı"
                  value={
                    <StatusBadge
                      label={mapConnectionLabel(Boolean(dashboard?.ikasConnected))}
                      tone={getBoolTone(Boolean(dashboard?.ikasConnected))}
                    />
                  }
                />
                <MetricCard
                  label="Son Senkron"
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
                  label="Mağaza Kimliği"
                  value={tenant?.merchantId || '-'}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Katalog Sağlığı"
              subtitle="Ürün ve varyant yüzeyinin doluluk, stok ve fiyat görünümü."
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
                  label="Aktif Ürün"
                  value={catalogHealth?.productCountActive ?? 0}
                  tone="success"
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
                  label="Fiyatı Dolu Varyant"
                  value={catalogHealth?.variantCountPriced ?? 0}
                  tone="success"
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
                gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)',
                gap: 16,
              }}
            >
              <SectionCard
                title="Politikalar ve İletişim Özeti"
                subtitle="Müşteri deneyimini doğrudan etkileyen metin ve contact blokları."
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                  }}
                >
                  <MetricCard
                    label="Kargo"
                    value={truncateText(policiesContact?.policies.shipping, 90)}
                  />
                  <MetricCard
                    label="Teslimat"
                    value={truncateText(policiesContact?.policies.delivery, 90)}
                  />
                  <MetricCard
                    label="İade"
                    value={truncateText(policiesContact?.policies.return, 90)}
                  />
                  <MetricCard
                    label="Değişim"
                    value={truncateText(policiesContact?.policies.exchange, 90)}
                  />
                  <MetricCard
                    label="Destek"
                    value={truncateText(policiesContact?.policies.support, 90)}
                  />
                  <MetricCard
                    label="İletişim"
                    value={truncateText(policiesContact?.policies.contact, 90)}
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
                    İletişim Kanalları
                  </div>

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
                              tone="neutral"
                            />
                            {channel.isPrimary ? (
                              <StatusBadge label="primary" tone="success" />
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

              <SectionCard
                title="Paneli Nasıl Kullanırım?"
                subtitle="Müşteri firmanın uygulamayı ilk gördüğünde öğrenmesini kolaylaştıran mini rehber."
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
                      Müşteri konuşmalarını aç, operatör görünümünü kontrol et ve gerekli
                      durumlarda manuel yanıt ver.
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
                      Ödeme, kargo ve müşteri hareketini sipariş ekranından takip et.
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
                      Hasarlı ürün, dekont, iade ve şikayet vakalarını operasyon merkezi
                      altında izle.
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
                      Ürün, varyant, policy ve contact içeriği güncel oldukça müşteri
                      deneyimi daha tutarlı olur.
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Ürün Önizlemesi"
              subtitle="Katalog içeriğinin ilk görünümü."
            >
              <SimpleDataTable
                columns={productColumns}
                rows={products?.items || []}
                emptyText="Henüz ürün verisi görünmüyor."
              />
            </SectionCard>

            <SectionCard
              title="Varyant Önizlemesi"
              subtitle="Renk, beden, stok ve fiyat görünümünün ilk tablosu."
            >
              <SimpleDataTable
                columns={variantColumns}
                rows={variants?.items || []}
                emptyText="Henüz varyant verisi görünmüyor."
              />
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
