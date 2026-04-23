'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { PoliciesContactResponse } from '@/lib/apparel-panel/types';

const POLICY_LABELS: Record<string, { title: string; helper: string }> = {
  shipping: {
    title: 'Kargo',
    helper: 'Sipariş hazırlama ve kargoya veriliş bilgisi.',
  },
  delivery: {
    title: 'Teslimat',
    helper: 'Teslimat süresi ve bölge/kargo yoğunluğu açıklaması.',
  },
  return: {
    title: 'İade',
    helper: 'İade süresi ve temel iade koşulları.',
  },
  exchange: {
    title: 'Değişim',
    helper: 'Beden, renk veya ürün değişimi koşulları.',
  },
  support: {
    title: 'Destek Saatleri',
    helper: 'Müşteri destek ekibinin dönüş saatleri.',
  },
  contact: {
    title: 'İletişim Notu',
    helper: 'Müşteriden istenecek ek bilgi veya yönlendirme notu.',
  },
};

function Badge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'neutral' }) {
  const styles =
    tone === 'success'
      ? { background: '#ecfdf5', color: '#065f46' }
      : tone === 'warning'
        ? { background: '#fffbeb', color: '#92400e' }
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
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        background: '#ffffff',
        padding: 18,
      }}
    >
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
    </div>
  );
}

function PolicyCard({ title, helper, text }: { title: string; helper: string; text: string | null }) {
  const hasText = Boolean(String(text || '').trim());

  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        background: '#ffffff',
        padding: 18,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{title}</div>
        <Badge label={hasText ? 'Aktif' : 'Eksik'} tone={hasText ? 'success' : 'warning'} />
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{helper}</div>
      <div
        style={{
          border: '1px solid #f3f4f6',
          borderRadius: 14,
          background: '#f9fafb',
          padding: 14,
          color: hasText ? '#374151' : '#9ca3af',
          lineHeight: 1.7,
          minHeight: 72,
        }}
      >
        {hasText ? text : 'Bu policy alanı için aktif metin bulunamadı.'}
      </div>
    </section>
  );
}

export default function PoliciesPage() {
  const [data, setData] = useState<PoliciesContactResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const token = await TokenHelpers.getTokenForIframeApp();

        if (!token) {
          setData({
            ok: false,
            fetchedAt: new Date().toISOString(),
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

        const res = await fetch('/api/apparel/policies', {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + token },
        });

        const json = await res.json();
        setData(json);
      } catch (error) {
        setData({
          ok: false,
          fetchedAt: new Date().toISOString(),
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
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const policyEntries = useMemo(() => {
    const policies = data?.policies || {
      shipping: null,
      delivery: null,
      return: null,
      exchange: null,
      support: null,
      contact: null,
    };

    return Object.entries(POLICY_LABELS).map(([key, meta]) => ({
      key,
      ...meta,
      text: policies[key as keyof typeof policies] || null,
    }));
  }, [data?.policies]);

  const activePolicyCount = policyEntries.filter((item) => String(item.text || '').trim()).length;
  const contactCount = data?.contactChannels?.length || 0;
  const tenantName = data?.tenant?.brandName || data?.tenant?.storeName || 'Tenant';

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
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Politikalar</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Kargo, teslimat, iade, değişim, destek ve iletişim bilgilerini tek ekranda izleyin.
            </p>
          </div>

          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              background: '#ffffff',
              padding: 14,
              color: '#6b7280',
              maxWidth: 360,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {tenantName} için Supabase tenant policy ve contact channel kayıtları canlı gösterilir.
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div
            style={{
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 14,
              padding: 16,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            {data.error}
          </div>
        ) : (
          <>
            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <MetricCard label="Toplam Policy" value={policyEntries.length} helper="Bu ekranda izlenen policy başlığı." />
              <MetricCard label="Aktif Policy" value={activePolicyCount} helper="Metni dolu ve müşteriye kullanılabilir policy sayısı." />
              <MetricCard label="İletişim Kanalı" value={contactCount} helper="Aktif contact channel kaydı." />
              <MetricCard label="Kaynak" value="Supabase" helper="Policy ve iletişim kayıtları canlı veri katmanından okunur." />
            </section>

            <section
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 0.8fr)',
                gap: 16,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {policyEntries.map((policy) => (
                  <PolicyCard key={policy.key} title={policy.title} helper={policy.helper} text={policy.text} />
                ))}
              </div>

              <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
                <section
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 18,
                    background: '#ffffff',
                    padding: 18,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>İletişim Kanalları</div>

                  {(data?.contactChannels || []).length === 0 ? (
                    <div style={{ color: '#6b7280', lineHeight: 1.7 }}>Aktif iletişim kanalı görünmüyor.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {(data?.contactChannels || []).map((channel) => (
                        <div
                          key={channel.id}
                          style={{
                            border: '1px solid #f3f4f6',
                            borderRadius: 14,
                            background: '#f9fafb',
                            padding: 14,
                            display: 'grid',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontWeight: 800 }}>{channel.label || channel.channelKey || 'İletişim'}</div>
                            <Badge label={channel.isActive ? 'Aktif' : 'Pasif'} tone={channel.isActive ? 'success' : 'neutral'} />
                          </div>
                          <div style={{ color: '#4b5563', lineHeight: 1.6 }}>{channel.displayValue || channel.value || '-'}</div>
                          {channel.availabilityText ? (
                            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                              {channel.availabilityText}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 18,
                    background: '#ffffff',
                    padding: 18,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Durum</div>
                  <div style={{ color: '#4b5563', lineHeight: 1.7 }}>
                    Bu sayfa artık placeholder değil. Policy ve iletişim verileri canlı API üzerinden okunuyor.
                  </div>
                </section>
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
