import type { ConversationDetailItem } from '@/lib/apparel-panel/types';

function mapCrmTagLabel(tag: string | null | undefined) {
  const normalized = String(tag || 'general').toLowerCase();
  if (normalized === 'vip_customer') return 'VIP müşteri';
  if (normalized === 'risky_customer') return 'Riskli müşteri';
  if (normalized === 'high_return_tendency') return 'İade eğilimi yüksek';
  if (normalized === 'needs_followup') return 'Tekrar takip edilecek';
  if (normalized === 'delivery_issue') return 'Problemli teslimat';
  if (normalized === 'hot_lead') return 'Potansiyel sıcak lead';
  return 'Genel müşteri';
}

function mapRiskLevelLabel(level: string | null | undefined) {
  const normalized = String(level || 'normal').toLowerCase();
  if (normalized === 'low') return 'Düşük';
  if (normalized === 'high') return 'Yüksek';
  if (normalized === 'critical') return 'Kritik';
  return 'Normal';
}

function mapFollowupStatusLabel(status: string | null | undefined) {
  const normalized = String(status || 'none').toLowerCase();
  if (normalized === 'follow_up') return 'Takip edilecek';
  if (normalized === 'waiting_customer') return 'Müşteri bekleniyor';
  if (normalized === 'operator_action_required') return 'Operatör aksiyonu gerekli';
  return 'Takip gerekmiyor';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function CrmPill({ label, tone }: { label: string; tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success' }) {
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
    <span style={{ display: 'inline-flex', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 800, ...styles }}>
      {label}
    </span>
  );
}

function getRiskTone(level: string | null | undefined): 'neutral' | 'info' | 'warning' | 'danger' | 'success' {
  if (level === 'critical' || level === 'high') return 'danger';
  if (level === 'low') return 'success';
  return 'info';
}

function getFollowupTone(status: string | null | undefined): 'neutral' | 'info' | 'warning' | 'danger' | 'success' {
  if (status === 'operator_action_required') return 'danger';
  if (status === 'waiting_customer') return 'warning';
  if (status === 'follow_up') return 'info';
  return 'neutral';
}

export function ConversationCrmAlertBox({ conversation }: { conversation: ConversationDetailItem }) {
  const hasCrmSignal = Boolean(
    conversation.crmProfileExists &&
      (conversation.crmTag !== 'general' ||
        conversation.riskLevel !== 'normal' ||
        conversation.followupStatus !== 'none' ||
        conversation.crmInternalNote),
  );

  if (!hasCrmSignal) {
    return null;
  }

  const highRisk = conversation.riskLevel === 'critical' || conversation.riskLevel === 'high' || conversation.followupStatus === 'operator_action_required';

  return (
    <section
      style={{
        border: highRisk ? '1px solid #fecaca' : '1px solid #bfdbfe',
        background: highRisk ? '#fff7ed' : '#eff6ff',
        color: highRisk ? '#9a3412' : '#1d4ed8',
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
        CRM Uyarısı
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
        Bu müşteri CRM tarafında özel takip bilgisiyle işaretlenmiş. Operatör yanıtı verirken bu bilgiyi dikkate almalı.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: conversation.crmInternalNote ? 12 : 0 }}>
        <CrmPill label={`CRM: ${mapCrmTagLabel(conversation.crmTag)}`} tone="info" />
        <CrmPill label={`Risk: ${mapRiskLevelLabel(conversation.riskLevel)}`} tone={getRiskTone(conversation.riskLevel)} />
        <CrmPill label={`Takip: ${mapFollowupStatusLabel(conversation.followupStatus)}`} tone={getFollowupTone(conversation.followupStatus)} />
        {conversation.crmUpdatedAt ? <CrmPill label={`Güncelleme: ${formatDate(conversation.crmUpdatedAt)}`} tone="neutral" /> : null}
      </div>

      {conversation.crmInternalNote ? (
        <div style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.6 }}>
          <strong>CRM iç notu:</strong> {conversation.crmInternalNote}
        </div>
      ) : null}
    </section>
  );
}
