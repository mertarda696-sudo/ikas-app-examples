'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TokenHelpers } from '@/helpers/token-helpers';

const EVIDENCE_STATE_OPTIONS = [
  { value: 'requested', label: 'Kanıt istendi' },
  { value: 'received', label: 'Kanıt alındı' },
  { value: 'verified', label: 'Doğrulandı' },
  { value: 'missing', label: 'Eksik' },
  { value: 'rejected', label: 'Reddedildi' },
];

function mapEvidenceLabel(value: string | null | undefined) {
  const found = EVIDENCE_STATE_OPTIONS.find((option) => option.value === value);
  return found?.label || value || 'Kanıt durumu yok';
}

function getCaseIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[0] === 'operations' ? parts[1] || '' : '';
}

function getCurrentEvidenceState() {
  const rows = Array.from(document.querySelectorAll('div'));
  const labelNode = rows.find((node) => String(node.textContent || '').trim() === 'Kanıt durumu');
  const valueNode = labelNode?.parentElement?.querySelectorAll('div')?.[1];
  const label = String(valueNode?.textContent || '').trim();

  const found = EVIDENCE_STATE_OPTIONS.find((option) => option.label === label || option.value === label);
  return found?.value || '';
}

function getCurrentEvidenceSummary() {
  const rows = Array.from(document.querySelectorAll('div'));
  const labelNode = rows.find((node) => String(node.textContent || '').trim() === 'Kanıt özeti');
  const valueNode = labelNode?.parentElement?.querySelectorAll('div')?.[1];
  const label = String(valueNode?.textContent || '').trim();

  if (!label || label === 'Henüz kanıt özeti yok.') return '';

  return label;
}

function findCardByTitle(titleText: string) {
  const titles = Array.from(document.querySelectorAll('div'));
  const title = titles.find((node) => String(node.textContent || '').trim() === titleText);
  return title?.parentElement || null;
}

function ensureActionHost() {
  const statusCard = findCardByTitle('Durum Güncelle');
  const aside = statusCard?.parentElement;
  const hostId = 'operation-evidence-action-panel-host';
  let host = document.getElementById(hostId);

  if (!statusCard || !aside) return null;

  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
  }

  if (host.parentElement !== aside) {
    aside.insertBefore(host, statusCard.nextSibling);
  }

  return host;
}

export function EvidenceStateEnhancer() {
  const [caseId, setCaseId] = useState('');
  const [value, setValue] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [host, setHost] = useState<HTMLElement | null>(null);

  const syncCurrentEvidenceValues = () => {
    const currentState = getCurrentEvidenceState();
    const currentSummary = getCurrentEvidenceSummary();

    setValue((previous) => previous || currentState);
    setSummary((previous) => previous || currentSummary);
  };

  useEffect(() => {
    setCaseId(getCaseIdFromPath());
    setHost(ensureActionHost());
    syncCurrentEvidenceValues();

    const timer = window.setTimeout(syncCurrentEvidenceValues, 250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (host) {
      syncCurrentEvidenceValues();
      return;
    }

    const observer = new MutationObserver(() => {
      const nextHost = ensureActionHost();
      if (nextHost) {
        setHost(nextHost);
        syncCurrentEvidenceValues();
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [host]);

  const handleChange = async (nextValue: string) => {
    try {
      setValue(nextValue);
      setStatus('saving');
      setMessage('');

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        throw new Error('iFrame JWT token alınamadı.');
      }

      const response = await fetch(`/api/apparel/operation-cases/${caseId}/evidence-state`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ evidenceState: nextValue }),
      });

      const raw = await response.json();

      if (!response.ok || !raw?.ok) {
        throw new Error(raw?.error || 'Kanıt durumu güncellenemedi.');
      }

      setStatus('success');
      setMessage(`Kanıt durumu güncellendi: ${mapEvidenceLabel(nextValue)}`);
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Kanıt durumu güncellenirken hata oluştu.');
    }
  };

  const handleSummarySave = async () => {
    try {
      setSummaryStatus('saving');
      setSummaryMessage('');

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        throw new Error('iFrame JWT token alınamadı.');
      }

      const response = await fetch(`/api/apparel/operation-cases/${caseId}/evidence-summary`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ evidenceSummary: summary }),
      });

      const raw = await response.json();

      if (!response.ok || !raw?.ok) {
        throw new Error(raw?.error || 'Kanıt özeti güncellenemedi.');
      }

      setSummaryStatus('success');
      setSummaryMessage('Kanıt özeti güncellendi.');
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setSummaryStatus('error');
      setSummaryMessage(error instanceof Error ? error.message : 'Kanıt özeti güncellenirken hata oluştu.');
    }
  };

  if (!host || !caseId) return null;

  return createPortal(
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginBottom: 8 }}>Operasyon Aksiyonları</div>
      <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        Vaka durumunu, kanıt sürecini ve operatör notunu bu alandan güncel tutun.
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#f9fafb', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#374151' }}>Kanıt Durumu</div>
            <span style={{ borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', padding: '4px 9px', fontSize: 11, fontWeight: 900 }}>
              {mapEvidenceLabel(value)}
            </span>
          </div>
          <select
            value={value || ''}
            onChange={(event) => handleChange(event.target.value)}
            disabled={status === 'saving'}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 12, padding: '10px 12px', background: status === 'saving' ? '#f3f4f6' : '#ffffff', color: '#111827', fontSize: 14, fontWeight: 800, cursor: status === 'saving' ? 'not-allowed' : 'pointer' }}
          >
            <option value="" disabled>Kanıt durumu seç</option>
            {EVIDENCE_STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {message ? (
            <div style={{ marginTop: 10, border: status === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0', background: status === 'error' ? '#fef2f2' : '#f0fdf4', color: status === 'error' ? '#991b1b' : '#166534', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800 }}>
              {message}
            </div>
          ) : null}
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#f9fafb', padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#374151', marginBottom: 8 }}>Kanıt Özeti</div>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value.slice(0, 1000))}
            disabled={summaryStatus === 'saving'}
            placeholder="Örn: Müşteriden hasarlı ürün fotoğrafı istendi."
            style={{ width: '100%', minHeight: 96, border: '1px solid #d1d5db', borderRadius: 12, padding: 12, background: summaryStatus === 'saving' ? '#f3f4f6' : '#ffffff', color: '#111827', fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>{summary.length}/1000 karakter</span>
            <button
              type="button"
              onClick={handleSummarySave}
              disabled={summaryStatus === 'saving'}
              style={{ border: 'none', borderRadius: 12, padding: '9px 13px', background: summaryStatus === 'saving' ? '#9ca3af' : '#111827', color: '#ffffff', fontWeight: 900, cursor: summaryStatus === 'saving' ? 'not-allowed' : 'pointer' }}
            >
              {summaryStatus === 'saving' ? 'Kaydediliyor...' : 'Kanıt Özetini Kaydet'}
            </button>
          </div>
          {summaryMessage ? (
            <div style={{ marginTop: 10, border: summaryStatus === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0', background: summaryStatus === 'error' ? '#fef2f2' : '#f0fdf4', color: summaryStatus === 'error' ? '#991b1b' : '#166534', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800 }}>
              {summaryMessage}
            </div>
          ) : null}
        </div>
      </div>
    </section>,
    host,
  );
}
