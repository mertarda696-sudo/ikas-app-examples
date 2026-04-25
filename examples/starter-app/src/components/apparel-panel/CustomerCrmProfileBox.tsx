'use client';

import { useEffect, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';

const CRM_TAG_OPTIONS = [
  { value: 'general', label: 'Genel müşteri' },
  { value: 'vip_customer', label: 'VIP müşteri' },
  { value: 'risky_customer', label: 'Riskli müşteri' },
  { value: 'high_return_tendency', label: 'İade eğilimi yüksek' },
  { value: 'needs_followup', label: 'Tekrar takip edilecek' },
  { value: 'delivery_issue', label: 'Problemli teslimat' },
  { value: 'hot_lead', label: 'Potansiyel sıcak lead' },
];

const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'critical', label: 'Kritik' },
];

const FOLLOWUP_STATUS_OPTIONS = [
  { value: 'none', label: 'Takip gerekmiyor' },
  { value: 'follow_up', label: 'Takip edilecek' },
  { value: 'waiting_customer', label: 'Müşteri bekleniyor' },
  { value: 'operator_action_required', label: 'Operatör aksiyonu gerekli' },
];

type CustomerCrmProfile = {
  id: string | null;
  customerWaId: string;
  crmTag: string;
  riskLevel: string;
  followupStatus: string;
  internalNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  exists: boolean;
};

type CustomerCrmProfileResponse = {
  ok: boolean;
  fetchedAt?: string;
  profile?: CustomerCrmProfile;
  error?: string;
};

type CustomerCrmProfileBoxProps = {
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

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function getOptionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label || value;
}

export function CustomerCrmProfileBox({ customerWaId }: CustomerCrmProfileBoxProps) {
  const [crmTag, setCrmTag] = useState('general');
  const [riskLevel, setRiskLevel] = useState('normal');
  const [followupStatus, setFollowupStatus] = useState('none');
  const [internalNote, setInternalNote] = useState('');
  const [profileExists, setProfileExists] = useState(false);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

        const response = await fetch(`/api/apparel/customers/${encodeURIComponent(customerWaId)}/crm-profile`, {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = (await response.json()) as CustomerCrmProfileResponse;

        if (!response.ok || !raw?.ok || !raw.profile) {
          throw new Error(raw?.error || 'CRM profili okunamadı.');
        }

        setCrmTag(raw.profile.crmTag || 'general');
        setRiskLevel(raw.profile.riskLevel || 'normal');
        setFollowupStatus(raw.profile.followupStatus || 'none');
        setInternalNote(raw.profile.internalNote || '');
        setProfileExists(Boolean(raw.profile.exists));
        setReviewedAt(raw.profile.reviewedAt || null);
        setUpdatedAt(raw.profile.updatedAt || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'CRM profili okunurken hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    if (customerWaId) {
      run();
    }
  }, [customerWaId]);

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

      const response = await fetch(`/api/apparel/customers/${encodeURIComponent(customerWaId)}/crm-profile`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          crmTag,
          riskLevel,
          followupStatus,
          internalNote,
        }),
      });

      const raw = (await response.json()) as CustomerCrmProfileResponse;

      if (!response.ok || !raw?.ok || !raw.profile) {
        throw new Error(raw?.error || 'CRM profili kaydedilemedi.');
      }

      setCrmTag(raw.profile.crmTag || 'general');
      setRiskLevel(raw.profile.riskLevel || 'normal');
      setFollowupStatus(raw.profile.followupStatus || 'none');
      setInternalNote(raw.profile.internalNote || '');
      setProfileExists(Boolean(raw.profile.exists));
      setReviewedAt(raw.profile.reviewedAt || null);
      setUpdatedAt(raw.profile.updatedAt || null);
      setSuccess('Müşteri CRM profili kaydedildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CRM profili kaydedilirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>CRM Etiketi ve Takip</div>
      <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
        Bu alan müşteri için kalıcı CRM etiketi, risk seviyesi, takip durumu ve operatör iç notunu tutar.
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>CRM profili yükleniyor...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 14, padding: 12, color: '#374151', fontSize: 13, lineHeight: 1.7 }}>
            <div><strong>Durum:</strong> {profileExists ? 'Kayıtlı CRM profili var' : 'Henüz kayıt yok, default değerler kullanılıyor'}</div>
            <div><strong>Etiket:</strong> {getOptionLabel(CRM_TAG_OPTIONS, crmTag)}</div>
            <div><strong>Risk:</strong> {getOptionLabel(RISK_LEVEL_OPTIONS, riskLevel)}</div>
            <div><strong>Takip:</strong> {getOptionLabel(FOLLOWUP_STATUS_OPTIONS, followupStatus)}</div>
            <div><strong>Son inceleme:</strong> {formatDate(reviewedAt)}</div>
            <div><strong>Son güncelleme:</strong> {formatDate(updatedAt)}</div>
          </div>

          <FieldLabel>
            CRM etiketi
            <select value={crmTag} onChange={(event) => setCrmTag(event.target.value)} style={inputStyle}>
              {CRM_TAG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FieldLabel>

          <FieldLabel>
            Risk seviyesi
            <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)} style={inputStyle}>
              {RISK_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FieldLabel>

          <FieldLabel>
            Takip durumu
            <select value={followupStatus} onChange={(event) => setFollowupStatus(event.target.value)} style={inputStyle}>
              {FOLLOWUP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FieldLabel>

          <FieldLabel>
            Operatör iç notu
            <textarea
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Bu müşteri için kalıcı CRM notu yazın."
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
            />
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
            {saving ? 'Kaydediliyor...' : 'CRM Profilini Kaydet'}
          </button>
        </div>
      )}

      {error ? (
        <div style={{ marginTop: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div style={{ marginTop: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700 }}>
          {success}
        </div>
      ) : null}
    </section>
  );
}
