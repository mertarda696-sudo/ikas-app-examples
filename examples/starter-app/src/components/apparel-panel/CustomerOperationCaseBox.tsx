'use client';

import { useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';

const CASE_TYPE_OPTIONS = [
  { value: 'general', label: 'Genel' },
  { value: 'order_support', label: 'Sipariş destek' },
  { value: 'return_exchange', label: 'İade / değişim' },
  { value: 'shipping_delivery', label: 'Kargo / teslimat' },
  { value: 'payment_proof', label: 'Ödeme / dekont' },
  { value: 'damaged_product', label: 'Hasarlı ürün' },
  { value: 'size_consultation', label: 'Beden danışma' },
  { value: 'hot_lead', label: 'Sıcak lead' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'critical', label: 'Kritik' },
];

type CustomerOperationCaseBoxProps = {
  customerWaId: string;
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

export function CustomerOperationCaseBox({ customerWaId }: CustomerOperationCaseBoxProps) {
  const [caseType, setCaseType] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      const normalizedTitle = title.trim();

      if (!normalizedTitle) {
        setError('Operasyon vakası için başlık zorunlu.');
        return;
      }

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setError('iFrame JWT token alınamadı.');
        return;
      }

      const response = await fetch(`/api/apparel/customers/${encodeURIComponent(customerWaId)}/operation-case`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caseType,
          priority,
          title: normalizedTitle,
          description,
        }),
      });

      const raw = await response.json();

      if (!response.ok || !raw?.ok) {
        throw new Error(raw?.error || 'Operasyon vakası oluşturulamadı.');
      }

      setSuccess(`Operasyon vakası oluşturuldu: ${raw.case?.caseNo || 'Yeni kayıt'}. Sayfa yenileniyor...`);
      setTitle('');
      setDescription('');
      setCaseType('general');
      setPriority('normal');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operasyon vakası oluşturulurken hata oluştu.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Bu Müşteri İçin Operasyon Vakası Oluştur</div>
      <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        Oluşturulan vaka otomatik olarak <strong>{customerWaId}</strong> müşterisine bağlanır. Müşterinin konuşması varsa en son konuşmayla da ilişkilendirilir.
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <FieldLabel>
          Vaka tipi
          <select value={caseType} onChange={(event) => setCaseType(event.target.value)} style={inputStyle}>
            {CASE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel>
          Öncelik
          <select value={priority} onChange={(event) => setPriority(event.target.value)} style={inputStyle}>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel>
          Başlık
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Örn: Müşteri genel takip kaydı"
            style={inputStyle}
          />
        </FieldLabel>

        <FieldLabel>
          Açıklama
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Bu müşteri için takip edilecek konuyu yazın."
            style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
          />
        </FieldLabel>

        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            border: 'none',
            borderRadius: 12,
            padding: '11px 14px',
            background: creating ? '#9ca3af' : '#111827',
            color: '#ffffff',
            fontWeight: 800,
            cursor: creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? 'Oluşturuluyor...' : 'Operasyon Vakası Oluştur'}
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
