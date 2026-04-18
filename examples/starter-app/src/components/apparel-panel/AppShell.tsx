'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

type NavItem = {
  href: string;
  label: string;
  hint: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    hint: 'Genel durum, katalog ve varyant özeti',
  },
  {
    href: '/inbox',
    label: 'Mesajlar',
    hint: 'WhatsApp konuşmaları ve müşteri akışı',
  },
  {
    href: '/catalog',
    label: 'Katalog',
    hint: 'Ürünler, varyantlar ve senkron görünümü',
  },
  {
    href: '/policies',
    label: 'Politikalar',
    hint: 'Kargo, iade, değişim ve iletişim metinleri',
  },
  {
    href: '/integrations',
    label: 'Entegrasyonlar',
    hint: 'WhatsApp, ikas ve ileride diğer kanallar',
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
          gridTemplateColumns: '280px minmax(0, 1fr)',
          minHeight: '100vh',
        }}
      >
        <aside
          style={{
            borderRight: '1px solid #e5e7eb',
            background: '#ffffff',
            padding: 20,
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
              borderRadius: 18,
              padding: 18,
              background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
              marginBottom: 20,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Apparel SaaS
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#111827',
                marginBottom: 8,
              }}
            >
              Giyim Paneli
            </div>

            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: '#4b5563',
              }}
            >
              Dashboard, mesajlar, katalog ve entegrasyon ekranlarını tek panelde
              toplayan müşteri görünümü.
            </div>
          </div>

          <nav style={{ display: 'grid', gap: 10 }}>
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    textDecoration: 'none',
                    border: active ? '1px solid #111827' : '1px solid #e5e7eb',
                    borderRadius: 16,
                    padding: 14,
                    background: active ? '#111827' : '#ffffff',
                    color: active ? '#ffffff' : '#111827',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 6px 16px rgba(17,24,39,0.10)' : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {item.label}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: active ? '#e5e7eb' : '#6b7280',
                    }}
                  >
                    {item.hint}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div
            style={{
              marginTop: 20,
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              padding: 14,
              background: '#fafafa',
              fontSize: 13,
              lineHeight: 1.6,
              color: '#6b7280',
            }}
          >
            İlk ürünleşen fazda dashboard ve WhatsApp inbox odaklı ilerliyoruz.
            Sonraki fazlarda medya/kanıt, operatör müdahalesi ve çok kanallı inbox
            bu yapının üstüne eklenecek.
          </div>
        </aside>

        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
