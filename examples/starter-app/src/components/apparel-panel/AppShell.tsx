'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

type NavItem = {
  href: string;
  label: string;
  hint: string;
  group: 'overview' | 'commerce' | 'system';
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    hint: 'Genel sağlık, katalog ve tenant özeti',
    group: 'overview',
  },
  {
    href: '/inbox',
    label: 'Mesajlar',
    hint: 'WhatsApp konuşmaları ve operatör görünümü',
    group: 'overview',
  },
  {
    href: '/orders',
    label: 'Siparişler',
    hint: 'Sipariş akışı, ödeme ve kargo durumu',
    group: 'commerce',
  },
  {
    href: '/operations',
    label: 'Operasyonlar',
    hint: 'Hasarlı ürün, dekont ve şikayet vakaları',
    group: 'commerce',
  },
  {
    href: '/catalog',
    label: 'Katalog',
    hint: 'Ürünler, varyantlar ve senkron görünümü',
    group: 'commerce',
  },
  {
    href: '/policies',
    label: 'Politikalar',
    hint: 'Kargo, iade, değişim ve iletişim metinleri',
    group: 'system',
  },
  {
    href: '/integrations',
    label: 'Entegrasyonlar',
    hint: 'WhatsApp, ikas ve ileride diğer kanallar',
    group: 'system',
  },
];

const NAV_GROUPS: Array<{
  key: NavItem['group'];
  label: string;
}> = [
  { key: 'overview', label: 'Genel Görünüm' },
  { key: 'commerce', label: 'Ticari Operasyon' },
  { key: 'system', label: 'Sistem ve Ayarlar' },
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
          gridTemplateColumns: '300px minmax(0, 1fr)',
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
              Giyim Operasyon Paneli
            </div>

            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: '#4b5563',
              }}
            >
              Mesajlar, siparişler, operasyon kayıtları ve katalog görünümünü tek
              panelde toplayan müşteri çalışma alanı.
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18 }}>
            {NAV_GROUPS.map((group) => {
              const items = NAV_ITEMS.filter((item) => item.group === group.key);

              return (
                <div key={group.key}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: 0.45,
                      marginBottom: 10,
                      paddingInline: 4,
                    }}
                  >
                    {group.label}
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {items.map((item) => {
                      const active = isActivePath(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          style={{
                            textDecoration: 'none',
                            border: active
                              ? '1px solid #111827'
                              : '1px solid #e5e7eb',
                            borderRadius: 16,
                            padding: 14,
                            background: active ? '#111827' : '#ffffff',
                            color: active ? '#ffffff' : '#111827',
                            transition: 'all 0.15s ease',
                            boxShadow: active
                              ? '0 6px 16px rgba(17,24,39,0.10)'
                              : 'none',
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
                  </div>
                </div>
              );
            })}
          </div>

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
            İlk ürünleşen fazda mesajlar, siparişler ve operasyon takibi birlikte
            ilerliyor. Sonraki fazlarda medya/kanıt yönetimi, sipariş entegrasyonu ve
            çok kanallı akış bu iskeletin üstüne eklenecek.
          </div>
        </aside>

        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
