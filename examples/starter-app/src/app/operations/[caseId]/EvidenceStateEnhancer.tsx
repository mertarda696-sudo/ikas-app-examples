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

function findEvidenceCard() {
  const titles = Array.from(document.querySelectorAll('div'));
  const title = titles.find((node) => String(node.textContent || '').trim() === 'Kanıt / Medya Bilgisi');
  return title?.parentElement || null;
}

function ensureEvidenceHost() {
  const card = findEvidenceCard();
  const hostId = 'operation-evidence-state-updater-host';
  let host = document.getElementById(hostId);

  if (!card) return null;

  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
    host.style.marginTop = '12px';
    card.insertBefore(host, card.lastElementChild || null);
  }

  return host;
}

export function EvidenceStateEnhancer() {
  const [caseId, setCaseId] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setCaseId(getCaseIdFromPath());
    setValue(getCurrentEvidenceState());
    setHost(ensureEvidenceHost());
  }, []);

  useEffect(() => {
    if (host) return;

    const observer = new MutationObserver(() => {
      const nextHost = ensureEvidenceHost();
      if (nextHost) {
        setHost(nextHost);
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

  if (!host || !caseId) return null;

  return createPortal(
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#f9fafb', padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: '#374151', marginBottom: 8 }}>Kanıt Durumu Güncelle</div>
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
    </div>,
    host,
  );
}
