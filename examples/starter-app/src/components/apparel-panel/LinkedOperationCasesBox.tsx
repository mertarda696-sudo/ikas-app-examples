'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';

type OperationCaseItem = {
  id: string;
  caseNo: string | null;
  caseType: string | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  sourceChannel: string | null;
  customerWaId: string | null;
  linkedOrderId: string | null;
  evidenceSummary: string | null;
  evidenceState: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  conversationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type OperationCasesResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  metrics: {
    total: number;
    open: number;
    highPriority: number;
    evidence: number;
  };
  items: OperationCaseItem[];
  error?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function mapCaseTypeLabel(type: string | null | undefined) {
  if (type === 'damaged_product') return 'Hasarlı Ürün';
  if (type === 'shipping_delivery') return 'Kargo / Teslimat';
  if (type === 'payment_proof') return 'Ödeme / Dekont';
  if (type === 'return_exchange') return 'İade / Değişim';
  if (type === 'size_consultation') return 'Beden Danışma';
  if (type === 'order_support') return 'Sipariş Destek';
  if (type === 'hot_lead') return 'Sıcak Lead';

  return 'Genel';
}

function mapPriorityLabel(priority: string | null | undefined) {
  if (priority === 'critical') return 'Kritik';
  if (priority === 'high') return 'Yüksek';
  if (priority === 'low') return 'Düşük';

  return 'Normal';
}

function mapStatusLabel(status: string | null | undefined) {
  if (status === 'open') return 'Açık';
  if (status === 'in_progress') return 'İnceleniyor';
  if (status === 'waiting_customer') return 'Müşteri Bekleniyor';
  if (status === 'resolved') return 'Çözüldü';
  if (status === 'closed') return 'Kapalı';

  return status || '-';
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'neutral' | 'info' | 'danger';
}) {
  const styles =
    tone === 'success'
      ? { background: '#ecfdf5', color: '#065f46' }
      : tone === 'warning'
        ? { background: '#fffbeb', color: '#92400e' }
        : tone === 'info'
          ? { background: '#eff6ff', color: '#1d4ed8' }
          : tone === 'danger'
            ? { background: '#fef2f2', color: '#991b1b' }
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

function priorityTone(priority: string | null | undefined) {
  if (priority === 'critical' || priority === 'high') return 'danger' as const;
  if (priority === 'low') return 'neutral' as const;

  return 'info' as const;
}

function statusTone(status: string | null | undefined) {
  if (status === 'open') return 'info' as const;
  if (status === 'in_progress') return 'warning' as const;
  if (status === 'resolved' || status === 'closed') return 'success' as const;

  return 'neutral' as const;
}

export function LinkedOperationCasesBox({
  conversationId,
}: {
  conversationId: string;
}) {
  const [items, setItems] = useState<OperationCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const iframeToken = await TokenHelpers.getTokenForIframeApp();

        if (!iframeToken) {
          setError('iFrame JWT token alınamadı.');
          return;
        }

        const response = await fetch('/api/apparel/operation-cases', {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = (await response.json()) as OperationCasesResponse;

        if (!response.ok || !raw?.ok) {
          throw new Error(raw?.error || 'Operasyon kayıtları alınamadı.');
        }

        setItems(raw.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Operasyon kayıtları alınırken hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const linkedCases = useMemo(
    () => items.filter((item) => item.conversationId === conversationId),
    [items, conversationId],
  );

  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        background: '#ffffff',
        padding: 18,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
        Bağlı Operasyon Kayıtları
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Operasyon kayıtları yükleniyor...</div>
      ) : error ? (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : linkedCases.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
          Bu konuşmaya bağlı operasyon kaydı henüz yok.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {linkedCases.map((caseItem) => (
            <div
              key={caseItem.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                background: '#f9fafb',
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <Badge label={caseItem.caseNo || 'Vaka'} tone="info" />
                <Badge label={mapCaseTypeLabel(caseItem.caseType)} tone="warning" />
                <Badge label={mapStatusLabel(caseItem.status)} tone={statusTone(caseItem.status)} />
                <Badge
                  label={`Öncelik: ${mapPriorityLabel(caseItem.priority)}`}
                  tone={priorityTone(caseItem.priority)}
                />
              </div>

              <div style={{ fontWeight: 800, color: '#111827', lineHeight: 1.4 }}>
                {caseItem.title || 'Başlıksız operasyon kaydı'}
              </div>

              {caseItem.description ? (
                <div style={{ marginTop: 6, color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>
                  {caseItem.description}
                </div>
              ) : null}

              <div style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
                Son güncelleme: {formatDate(caseItem.updatedAt || caseItem.createdAt)}
              </div>

              <Link
                href="/operations"
                style={{
                  display: 'inline-block',
                  marginTop: 10,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#111827',
                }}
              >
                Operasyonlar ekranında gör →
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
