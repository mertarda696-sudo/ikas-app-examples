'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';

type OperationType =
  | 'all'
  | 'damaged_product'
  | 'shipping_issue'
  | 'general_complaint'
  | 'payment_proof'
  | 'return_exchange';

const TYPE_OPTIONS: Array<{ key: OperationType; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'damaged_product', label: 'Hasarlı Ürün' },
  { key: 'shipping_issue', label: 'Kargo Şikayeti' },
  { key: 'general_complaint', label: 'Genel Şikayet' },
  { key: 'payment_proof', label: 'Ödeme / Dekont' },
  { key: 'return_exchange', label: 'İade / Değişim' },
];

const CASE_ROWS = [
  {
    id: 'OP-301',
    type: 'damaged_product' as OperationType,
    title: 'Kargo sonrası hasarlı ürün bildirimi',
    customer: '905457464945',
    orderId: 'SIP-10428',
    priority: 'Yüksek',
    status: 'İnceleniyor',
    assignee: 'Operatör 1',
    updatedAt: '15.04.2026 23:18',
    evidenceSummary: '2 görsel + 1 video',
    evidenceState: 'Kanıt kontrolü gerekli',
  },
  {
    id: 'OP-302',
    type: 'shipping_issue' as OperationType,
    title: 'Teslimat gecikmesi şikayeti',
    customer: '905457464945',
    orderId: 'SIP-10412',
    priority: 'Normal',
    status: 'Müşteri bekleniyor',
    assignee: 'Operatör 2',
    updatedAt: '15.04.2026 19:42',
    evidenceSummary: 'Belge yok / konuşma bazlı',
    evidenceState: 'Kargo yanıtı bekleniyor',
  },
  {
    id: 'OP-303',
    type: 'payment_proof' as OperationType,
    title: 'Dekont doğrulama bekliyor',
    customer: '9055•••',
    orderId: 'SIP-10387',
    priority: 'Kritik',
    status: 'Yeni',
    assignee: 'Finans Kuyruğu',
    updatedAt: '15.04.2026 14:09',
    evidenceSummary: '1 dekont PDF + 1 ekran görüntüsü',
    evidenceState: 'Finans doğrulaması gerekli',
  },
  {
    id: 'OP-304',
    type: 'return_exchange' as OperationType,
    title: 'Beden değişim talebi',
    customer: '9055•••',
    orderId: 'SIP-10374',
    priority: 'Normal',
    status: 'Çözüldü',
    assignee: 'Operatör 1',
    updatedAt: '14.04.2026 16:27',
    evidenceSummary: '1 form / 1 not',
    evidenceState: 'Kapanış sonrası arşiv',
  },
];

function TypePill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        borderRadius: 999,
        padding: '5px 10px',
        fontSize: 12,
        fontWeight: 700,
        background: '#eef2ff',
        color: '#3730a3',
      }}
    >
      {label}
    </span>
  );
}

function PriorityPill({ label }: { label: string }) {
  const styles =
    label === 'Kritik'
      ? { background: '#fef2f2', color: '#991b1b' }
      : label === 'Yüksek'
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

function StatusPill({ label }: { label: string }) {
  const styles =
    label === 'Çözüldü'
      ? { background: '#ecfdf5', color: '#065f46' }
      : label === 'Yeni'
        ? { background: '#eff6ff', color: '#1d4ed8' }
        : label === 'İnceleniyor'
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

function EvidencePill({ label }: { label: string }) {
  const styles =
    label.includes('gerekli')
      ? { background: '#fffbeb', color: '#92400e' }
      : label.includes('doğrulaması')
        ? { background: '#fef2f2', color: '#991b1b' }
        : label.includes('arşiv')
          ? { background: '#ecfdf5', color: '#065f46' }
          : { background: '#eff6ff', color: '#1d4ed8' };

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

function mapTypeLabel(type: OperationType) {
  if (type === 'damaged_product') return 'Hasarlı Ürün';
  if (type === 'shipping_issue') return 'Kargo Şikayeti';
  if (type === 'general_complaint') return 'Genel Şikayet';
  if (type === 'payment_proof') return 'Ödeme / Dekont';
  if (type === 'return_exchange') return 'İade / Değişim';
  return 'Tümü';
}

export default function OperationsPage() {
  const [activeType, setActiveType] = useState<OperationType>('all');

  const rows = useMemo(() => {
    if (activeType === 'all') return CASE_ROWS;
    return CASE_ROWS.filter((item) => item.type === activeType);
  }, [activeType]);

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
            <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
              Operasyonlar
            </h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
              Hasarlı ürün, kargo şikayeti, dekont ve diğer operasyon vakalarını tek
              ekranda toplamak için hazırlanan vaka merkezi.
            </p>
          </div>

          <div
            style={{
              border: '1px dashed #d1d5db',
              borderRadius: 16,
              background: '#ffffff',
              padding: 14,
              color: '#6b7280',
              maxWidth: 340,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Bu sayfa artık sadece vaka listesi değil, aynı zamanda hangi kayıtta
            kanıt/medya bulunduğunu ve operatörün nereye girmesi gerektiğini de özetler.
          </div>
        </div>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Açık Vaka
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>11</div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Kanıt İçeren
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>6</div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              Finans Öncelikli
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>2</div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              background: '#ffffff',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              İnceleme Bekleyen
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>4</div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              border: '1px solid #fde68a',
              borderRadius: 16,
              background: '#fffbeb',
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
              Hasarlı ürün vakalarında kanıtı önce aç
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.6 }}>
              Fotoğraf ve video varsa operatör önce görsel/kanıt kontrolü yapmalı.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #fecaca',
              borderRadius: 16,
              background: '#fef2f2',
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>
              Dekont vakaları finans kuyruğuna yakın
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.6 }}>
              PDF, ekran görüntüsü veya ödeme kanıtı varsa önce doğrulama durumu netleşmeli.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              background: '#ffffff',
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 800, color: '#111827', marginBottom: 6 }}>
              Ana kanıt merkezi operasyon detail olacak
            </div>
            <div style={{ color: '#4b5563', lineHeight: 1.6 }}>
              Medya ve belge detayları vaka ekranı içinde incelenir; diğer ekranlar bunu yalnız özetler.
            </div>
          </div>
        </section>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#ffffff',
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
            Vaka Tipleri
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {TYPE_OPTIONS.map((option) => {
              const active = activeType === option.key;

              return (
                <button
                  key={option.key}
                  onClick={() => setActiveType(option.key)}
                  style={{
                    border: active ? '1px solid #111827' : '1px solid #d1d5db',
                    background: active ? '#111827' : '#ffffff',
                    color: active ? '#ffffff' : '#111827',
                    borderRadius: 999,
                    padding: '9px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#ffffff',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: 18,
              borderBottom: '1px solid #e5e7eb',
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            Operasyon Listesi
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 1220,
              }}
            >
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {[
                    'Vaka No',
                    'Tip',
                    'Başlık',
                    'Müşteri',
                    'Sipariş',
                    'Öncelik',
                    'Durum',
                    'Sorumlu',
                    'Kanıt Özeti',
                    'Kanıt Durumu',
                    'Son Güncelleme',
                    'Detay',
                  ].map((header) => (
                    <th
                      key={header}
                      style={{
                        textAlign: 'left',
                        padding: 14,
                        fontSize: 13,
                        color: '#6b7280',
                        fontWeight: 800,
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td
                      style={{
                        padding: 14,
                        borderBottom: '1px solid #f3f4f6',
                        fontWeight: 700,
                      }}
                    >
                      {row.id}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <TypePill label={mapTypeLabel(row.type)} />
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      {row.title}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      {row.customer}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      {row.orderId}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <PriorityPill label={row.priority} />
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <StatusPill label={row.status} />
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      {row.assignee}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      {row.evidenceSummary}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <EvidencePill label={row.evidenceState} />
                    </td>
                    <td
                      style={{
                        padding: 14,
                        borderBottom: '1px solid #f3f4f6',
                        color: '#6b7280',
                      }}
                    >
                      {row.updatedAt}
                    </td>
                    <td style={{ padding: 14, borderBottom: '1px solid #f3f4f6' }}>
                      <Link
                        href={`/operations/${row.id}`}
                        style={{
                          textDecoration: 'none',
                          color: '#111827',
                          fontWeight: 700,
                        }}
                      >
                        Detayı Aç →
                      </Link>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      style={{
                        padding: 18,
                        color: '#6b7280',
                      }}
                    >
                      Seçili filtrede gösterilecek vaka bulunmuyor.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
