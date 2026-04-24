'use client';

import { useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';

const ORDER_STATUS_OPTIONS = [
  { value: 'draft', label: 'Taslak' },
  { value: 'pending', label: 'Bekliyor' },
  { value: 'confirmed', label: 'Onaylandı' },
  { value: 'processing', label: 'Hazırlanıyor' },
  { value: 'shipped', label: 'Kargoda' },
  { value: 'delivered', label: 'Teslim edildi' },
  { value: 'canceled', label: 'İptal edildi' },
  { value: 'returned', label: 'İade edildi' },
  { value: 'partially_returned', label: 'Kısmi iade' },
];

const FINANCIAL_STATUS_OPTIONS = [
  { value: 'unknown', label: 'Bilinmiyor' },
  { value: 'pending', label: 'Ödeme bekliyor' },
  { value: 'paid', label: 'Ödendi' },
  { value: 'partially_paid', label: 'Kısmi ödeme' },
  { value: 'refunded', label: 'İade edildi' },
  { value: 'partially_refunded', label: 'Kısmi iade' },
  { value: 'failed', label: 'Başarısız' },
  { value: 'voided', label: 'İptal' },
];

const FULFILLMENT_STATUS_OPTIONS = [
  { value: 'unfulfilled', label: 'Hazırlanmadı' },
  { value: 'partial', label: 'Kısmi hazırlandı' },
  { value: 'fulfilled', label: 'Hazırlandı' },
  { value: 'returned', label: 'İade' },
  { value: 'canceled', label: 'İptal' },
];

type OrderStatusUpdateBoxProps = {
  orderId: string;
  initialStatus: string | null;
  initialFinancialStatus: string | null;
  initialFulfillmentStatus: string | null;
  initialShippingMethod: string | null;
  initialCargoCompany: string | null;
  initialTrackingNumber: string | null;
  initialTrackingUrl: string | null;
  initialNote: string | null;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 800, color: '#374151' }}>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 14,
  color: '#111827',
  background: '#ffffff',
  outline: 'none',
};

export function OrderStatusUpdateBox({
  orderId,
  initialStatus,
  initialFinancialStatus,
  initialFulfillmentStatus,
  initialShippingMethod,
  initialCargoCompany,
  initialTrackingNumber,
  initialTrackingUrl,
  initialNote,
}: OrderStatusUpdateBoxProps) {
  const [status, setStatus] = useState(initialStatus || 'pending');
  const [financialStatus, setFinancialStatus] = useState(initialFinancialStatus || 'unknown');
  const [fulfillmentStatus, setFulfillmentStatus] = useState(initialFulfillmentStatus || 'unfulfilled');
  const [shippingMethod, setShippingMethod] = useState(initialShippingMethod || '');
  const [cargoCompany, setCargoCompany] = useState(initialCargoCompany || '');
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber || '');
  const [trackingUrl, setTrackingUrl] = useState(initialTrackingUrl || '');
  const [note, setNote] = useState(initialNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setError('iFrame JWT token alınamadı.');
        return;
      }

      const response = await fetch(`/api/apparel/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          financialStatus,
          fulfillmentStatus,
          shippingMethod,
          cargoCompany,
          trackingNumber,
          trackingUrl,
          note,
        }),
      });

      const raw = await response.json();

      if (!response.ok || !raw?.ok) {
        throw new Error(raw?.error || 'Sipariş güncellenemedi.');
      }

      setSuccess('Sipariş bilgileri güncellendi. Sayfa yenileniyor...');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sipariş güncellenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Sipariş Güncelle</div>

      <div style={{ display: 'grid', gap: 12 }}>
        <FieldLabel>
          Sipariş durumu
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={inputStyle}>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel>
          Ödeme durumu
          <select value={financialStatus} onChange={(event) => setFinancialStatus(event.target.value)} style={inputStyle}>
            {FINANCIAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel>
          Hazırlık / fulfillment durumu
          <select value={fulfillmentStatus} onChange={(event) => setFulfillmentStatus(event.target.value)} style={inputStyle}>
            {FULFILLMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel>
          Kargo yöntemi
          <input value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)} placeholder="Standart Kargo" style={inputStyle} />
        </FieldLabel>

        <FieldLabel>
          Kargo firması
          <input value={cargoCompany} onChange={(event) => setCargoCompany(event.target.value)} placeholder="Yurtiçi Kargo" style={inputStyle} />
        </FieldLabel>

        <FieldLabel>
          Takip numarası
          <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Kargo takip numarası" style={inputStyle} />
        </FieldLabel>

        <FieldLabel>
          Takip linki
          <input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://..." style={inputStyle} />
        </FieldLabel>

        <FieldLabel>
          Sipariş notu
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Sipariş için iç not" style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }} />
        </FieldLabel>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            border: 'none',
            borderRadius: 12,
            padding: '11px 14px',
            background: saving ? '#9ca3af' : '#111827',
            color: '#ffffff',
            fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Kaydediliyor...' : 'Siparişi Güncelle'}
        </button>

        {error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        ) : null}

        {success ? (
          <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700 }}>
            {success}
          </div>
        ) : null}
      </div>
    </section>
  );
}
