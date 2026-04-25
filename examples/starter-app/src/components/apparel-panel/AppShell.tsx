'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { DashboardOperationsHub } from '@/components/apparel-panel/DashboardOperationsHub';

type NavItem = {
  href: string;
  label: string;
  hint: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    hint: 'Genel özet',
  },
  {
    href: '/inbox',
    label: 'Mesajlar',
    hint: 'Konuşmalar',
  },
  {
    href: '/operator-actions',
    label: 'Aksiyon Merkezi',
    hint: 'Operatör kuyruğu',
  },
  {
    href: '/orders',
    label: 'Siparişler',
    hint: 'Sipariş ve ödeme',
  },
  {
    href: '/operations',
    label: 'Operasyonlar',
    hint: 'Vaka merkezi',
  },
  {
    href: '/evidence',
    label: 'Kanıtlar',
    hint: 'Medya ve dekont',
  },
  {
    href: '/system-health',
    label: 'Sistem Sağlığı',
    hint: 'Teknik özet',
  },
  {
    href: '/catalog',
    label: 'Katalog',
    hint: 'Ürün ve varyant',
  },
  {
    href: '/policies',
    label: 'Politikalar',
    hint: 'Kural ve iletişim',
  },
  {
    href: '/integrations',
    label: 'Entegrasyonlar',
    hint: 'Bağlantılar',
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showDashboardOperationsHub = pathname === '/dashboard';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px minmax(0, 1fr)',
          minHeight: '100vh',
        }}
      >
        <aside
          style={{
            borderRight: '1px solid #e5e7eb',
            background: '#ffffff',
            padding: 12,
            position: 'sticky',
            top: 0,
            alignSelf: 'start',
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 12,
              background: '#ffffff',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 0.45,
                marginBottom: 6,
              }}
            >
              Apparel SaaS
            </div>

            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: '#111827',
                marginBottom: 6,
                lineHeight: 1.3,
              }}
            >
              Giyim Paneli
            </div>

            <div
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: '#6b7280',
              }}
            >
              Mesaj, sipariş ve operasyon takibini tek alanda toplar.
            </div>
          </div>

          <nav style={{ display: 'grid', gap: 8 }}>
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    textDecoration: 'none',
                    border: active ? '1px solid #111827' : '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 10,
                    background: active ? '#111827' : '#ffffff',
                    color: active ? '#ffffff' : '#111827',
                    display: 'block',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      marginBottom: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.label}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.35,
                      color: active ? '#e5e7eb' : '#6b7280',
                    }}
                  >
                    {item.hint}
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div style={{ minWidth: 0 }}>
          {showDashboardOperationsHub ? (
            <>
              <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px 0' }}>
                <DashboardOperationsHub />
              </div>

              <div style={{ maxWidth: 1200, margin: '16px auto 0', padding: '0 20px 20px' }}>
                <Link
                  href="/system-health"
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    background: '#ffffff',
                    padding: '14px 16px',
                    color: '#111827',
                    fontWeight: 900,
                  }}
                >
                  Sistem Sağlığına Git →
                  <span style={{ display: 'block', marginTop: 4, color: '#6b7280', fontSize: 13, fontWeight: 600 }}>
                    Katalog sağlığı, policy özeti, sync durumu ve teknik bağlantılar ayrı sayfada izlenir.
                  </span>
                </Link>
              </div>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
