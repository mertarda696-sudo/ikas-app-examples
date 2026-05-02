'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { CustomerProfileLink } from '@/components/apparel-panel/CustomerProfileLink';
import { TokenHelpers } from '@/helpers/token-helpers';
import {
  mapCaseTypeLabel,
  mapCrmTagLabel,
  mapEvidenceStateLabel,
  mapFollowupStatusLabel,
  mapPriorityLabel,
  mapRiskLevelLabel,
  mapStatusLabel,
} from '@/lib/apparel-panel/labels';

type OperationCaseAttachment = {
  id: string;
  messageId: string | null;
  kind: string | null;
  mimeType: string | null;
  fileName: string | null;
  storagePath: string | null;
  storageBucket?: string | null;
  sizeBytes: number | null;
  whatsappMediaId: string | null;
  mediaSha256: string | null;
  externalMessageId: string | null;
  caption: string | null;
  customerWaId: string | null;
  linkedOrderId: string | null;
  caseNo: string | null;
  caseType: string | null;
  captureStatus: string | null;
  signedUrl?: string | null;
  signedUrlError?: string | null;
  createdAt: string | null;
};

type OperationCaseEvent = {
  id: string;
  eventType: string | null;
  eventLabel: string | null;
  eventNote: string | null;
  actorType: string | null;
  actorId: string | null;
  source: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string | null;
};

type OperationCaseDetail = {
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
  resolvedAt: string | null;
  closedAt: string | null;
  crmProfileExists: boolean;
  crmTag: string | null;
  riskLevel: string | null;
  followupStatus: string | null;
  crmInternalNote: string | null;
  crmReviewedAt: string | null;
  crmUpdatedAt: string | null;
  attachments?: OperationCaseAttachment[];
  events?: OperationCaseEvent[];
};

type OperationCaseDetailResponse = {
  ok: boolean;
  fetchedAt: string;
  tenant: unknown | null;
  operationCase: OperationCaseDetail | null;
  error?: string;
};

type EvidenceActionKey = 'verify_evidence' | 'request_more_evidence' | 'mark_evidence_insufficient' | 'start_review' | 'resolve_case';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Açık' },
  { value: 'in_progress', label: 'İnceleniyor' },
  { value: 'waiting_customer', label: 'Müşteri Bekleniyor' },
  { value: 'resolved', label: 'Çözüldü' },
  { value: 'closed', label: 'Kapalı' },
];

const EVIDENCE_ACTIONS: Array<{ action: EvidenceActionKey; label: string; helper: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' }> = [
  {
    action: 'verify_evidence',
    label: 'Kanıtı Doğrula',
    helper: 'Fotoğraf/dekont yeterli görünüyor. Kanıt doğrulandı, vaka incelemeye alınır.',
    tone: 'success',
  },
  {
    action: 'request_more_evidence',
    label: 'Ek Kanıt İste',
    helper: 'Müşteriden yeni fotoğraf, video veya belge istenecek. Vaka müşteri bekliyor olur.',
    tone: 'warning',
  },
  {
    action: 'mark_evidence_insufficient',
    label: 'Kanıt Yetersiz',
    helper: 'Mevcut medya yeterli değil. Kanıt yetersiz olarak işaretlenir.',
    tone: 'danger',
  },
  {
    action: 'start_review',
    label: 'İncelemeye Al',
    helper: 'Vaka operasyon ekibi tarafından inceleniyor olarak işaretlenir.',
    tone: 'info',
  },
  {
    action: 'resolve_case',
    label: 'Çözüldü Yap',
    helper: 'Kanıt incelemesi tamamlandıysa vaka çözüldü olarak işaretlenir.',
    tone: 'success',
  },
];

const OPERATOR_REPLY_TEMPLATES = [
  'Fotoğrafınızı aldık, ekibimiz kontrol ediyor. En kısa sürede sizi bilgilendireceğiz.',
  'Ek bir fotoğraf daha paylaşabilir misiniz? Ürünün hasarlı bölümü daha net görünürse süreci hızlandırabiliriz.',
  'İade/değişim süreci için kaydınızı incelemeye aldık. Ekibimiz kontrol sonrası sizi bilgilendirecek.',
];

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return value;
  }
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  if (value === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, index);

  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function mapAttachmentKindLabel(kind: string | null | undefined) {
  const normalized = String(kind || '').toLowerCase();

  if (normalized === 'image') return 'Fotoğraf';
  if (normalized === 'video') return 'Video';
  if (normalized === 'audio') return 'Ses kaydı';
  if (normalized === 'document') return 'Doküman';
  if (normalized === 'sticker') return 'Sticker';

  return kind || 'Medya';
}

function mapCaptureStatusLabel(status: string | null | undefined) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'metadata_only') return 'Metadata kaydedildi';
  if (normalized === 'downloaded') return 'Dosya indirildi';
  if (normalized === 'stored') return 'Storage’a yüklendi';
  if (normalized === 'failed') return 'İşleme hatası';

  return status || 'Durum bilinmiyor';
}

function captureStatusTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'stored' || normalized === 'downloaded') return 'success';
  if (normalized === 'metadata_only') return 'info';
  if (normalized === 'failed') return 'danger';

  return 'neutral';
}

function Badge({ label, tone }: { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger' }) {
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
    <span style={{ display: 'inline-flex', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 900, ...styles }}>
      {label}
    </span>
  );
}

function statusTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'open') return 'info';
  if (status === 'in_progress' || status === 'waiting_customer') return 'warning';
  return 'neutral';
}

function priorityTone(priority: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'low') return 'neutral';
  return 'info';
}

function riskTone(level: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (level === 'critical' || level === 'high') return 'danger';
  if (level === 'low') return 'success';
  return 'info';
}

function followupTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'operator_action_required') return 'danger';
  if (status === 'waiting_customer') return 'warning';
  if (status === 'follow_up') return 'info';
  return 'neutral';
}

function evidenceTone(state: string | null | undefined): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (state === 'verified') return 'success';
  if (state === 'received') return 'info';
  if (state === 'requested' || state === 'missing') return 'warning';
  if (state === 'rejected') return 'danger';
  return 'neutral';
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 18, background: '#ffffff', padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: 10, padding: '9px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
      <div style={{ color: '#6b7280', fontWeight: 800 }}>{label}</div>
      <div style={{ color: '#111827', lineHeight: 1.6, minWidth: 0, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function AttachmentField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
      <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.35 }}>{label}</div>
      <div style={{ color: '#111827', fontSize: 13, lineHeight: 1.55, minWidth: 0, overflowWrap: 'anywhere' }}>{value || '-'}</div>
    </div>
  );
}

function ActionButton({ label, tone, disabled, onClick }: { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' | 'danger'; disabled?: boolean; onClick: () => void }) {
  const styles =
    tone === 'success'
      ? { border: '1px solid #16a34a', color: '#166534', background: '#f0fdf4' }
      : tone === 'warning'
        ? { border: '1px solid #d97706', color: '#92400e', background: '#fffbeb' }
        : tone === 'danger'
          ? { border: '1px solid #dc2626', color: '#991b1b', background: '#fef2f2' }
          : tone === 'info'
            ? { border: '1px solid #2563eb', color: '#1d4ed8', background: '#eff6ff' }
            : { border: '1px solid #d1d5db', color: '#111827', background: '#ffffff' };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles,
        width: '100%',
        borderRadius: 12,
        padding: '10px 12px',
        fontSize: 13,
        fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}

function AttachmentCard({ attachment, index }: { attachment: OperationCaseAttachment; index: number }) {
  const storageValue = attachment.storagePath || 'metadata_only / dosya henüz indirilmedi';
  const isImage = String(attachment.kind || '').toLowerCase() === 'image' || String(attachment.mimeType || '').toLowerCase().startsWith('image/');
  const hasPreview = Boolean(isImage && attachment.signedUrl);

  return (
    <article style={{ border: '1px solid #e5e7eb', borderRadius: 16, background: '#f9fafb', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#111827', fontSize: 15, fontWeight: 900 }}>
            {mapAttachmentKindLabel(attachment.kind)} #{index + 1}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }}>
            {attachment.mimeType || 'MIME bilgisi yok'} · {formatDate(attachment.createdAt)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={mapAttachmentKindLabel(attachment.kind)} tone="neutral" />
          <Badge label={mapCaptureStatusLabel(attachment.captureStatus)} tone={captureStatusTone(attachment.captureStatus)} />
        </div>
      </div>

      {hasPreview ? (
        <div style={{ marginBottom: 12 }}>
          <a href={attachment.signedUrl || '#'} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
            <img
              src={attachment.signedUrl || ''}
              alt={attachment.caption || `Medya kaydı ${index + 1}`}
              style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 14, border: '1px solid #e5e7eb', background: '#ffffff' }}
            />
          </a>
          <div style={{ marginTop: 8, color: '#6b7280', fontSize: 12, fontWeight: 800 }}>
            Görsel özel Storage bucket’tan geçici imzalı bağlantıyla gösteriliyor.
          </div>
        </div>
      ) : attachment.storagePath && attachment.signedUrl ? (
        <div style={{ marginBottom: 12 }}>
          <a href={attachment.signedUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#111827', fontWeight: 900 }}>
            Dosyayı aç →
          </a>
        </div>
      ) : attachment.storagePath && attachment.signedUrlError ? (
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800, lineHeight: 1.55, marginBottom: 12 }}>
          Önizleme bağlantısı üretilemedi: {attachment.signedUrlError}
        </div>
      ) : null}

      {attachment.caption ? (
        <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', color: '#1e3a8a', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 800, lineHeight: 1.55, marginBottom: 12 }}>
          Caption: {attachment.caption}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <AttachmentField label="WhatsApp Media ID" value={attachment.whatsappMediaId || '-'} />
        <AttachmentField label="Message ID" value={attachment.messageId || '-'} />
        <AttachmentField label="External Message ID" value={attachment.externalMessageId || '-'} />
        <AttachmentField label="Dosya adı" value={attachment.fileName || '-'} />
        <AttachmentField label="Dosya boyutu" value={formatBytes(attachment.sizeBytes)} />
        <AttachmentField label="Storage bucket" value={attachment.storageBucket || '-'} />
        <AttachmentField label="Storage path" value={storageValue} />
        <AttachmentField label="Media SHA256" value={attachment.mediaSha256 || '-'} />
        <AttachmentField label="Bağlı sipariş" value={attachment.linkedOrderId || '-'} />
      </div>
    </article>
  );
}

function getRecommendedAction(operationCase: OperationCaseDetail) {
  if (operationCase.status === 'resolved' || operationCase.status === 'closed') {
    return {
      title: 'Vaka kapanış kontrolünde',
      helper: 'Vaka çözülmüş veya kapalı görünüyor. Gerekirse konuşma, sipariş ve kanıt bağlarını arşiv kontrolü için açın.',
      tone: 'success' as const,
    };
  }

  if (operationCase.riskLevel === 'critical' || operationCase.priority === 'critical') {
    return {
      title: 'Kritik öncelikli işlem',
      helper: 'Bu vaka hızlı operatör kontrolü gerektiriyor. Önce müşteri profili, konuşma ve sipariş bağlantılarını doğrulayın.',
      tone: 'danger' as const,
    };
  }

  if (operationCase.riskLevel === 'high' || operationCase.priority === 'high' || operationCase.followupStatus === 'operator_action_required') {
    return {
      title: 'Öncelikli takip gerekli',
      helper: 'CRM riski, yüksek öncelik veya operatör aksiyonu sinyali var. Vaka durumunu güncel tutun ve gerekiyorsa müşteriye konuşmadan dönüş yapın.',
      tone: 'warning' as const,
    };
  }

  if (operationCase.evidenceState === 'requested' || operationCase.evidenceState === 'missing') {
    return {
      title: 'Kanıt bekleniyor',
      helper: 'Kanıt istenmiş veya eksik görünüyor. Kanıtlar ekranı ve konuşma detayı birlikte kontrol edilmeli.',
      tone: 'warning' as const,
    };
  }

  return {
    title: 'Normal operasyon takibi',
    helper: 'Vaka açık ya da inceleniyor olabilir. Konuşma, sipariş ve müşteri profili bağlantıları üzerinden rutin takibi sürdürebilirsiniz.',
    tone: 'info' as const,
  };
}

export default function OperationCaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = Array.isArray(params?.caseId) ? params.caseId[0] : params?.caseId;

  const [data, setData] = useState<OperationCaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [runningEvidenceAction, setRunningEvidenceAction] = useState<EvidenceActionKey | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [operatorNote, setOperatorNote] = useState('');
  const [savingOperatorNote, setSavingOperatorNote] = useState(false);
  const [operatorNoteError, setOperatorNoteError] = useState<string | null>(null);
  const [operatorNoteSuccess, setOperatorNoteSuccess] = useState<string | null>(null);
  const [operatorReply, setOperatorReply] = useState('');
  const [sendingOperatorReply, setSendingOperatorReply] = useState(false);
  const [operatorReplyError, setOperatorReplyError] = useState<string | null>(null);
  const [operatorReplySuccess, setOperatorReplySuccess] = useState<string | null>(null);

  const loadCase = async (options?: { silent?: boolean }) => {
    try {
      if (!caseId) {
        setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, operationCase: null, error: 'caseId bulunamadı.' });
        return;
      }

      if (!options?.silent) setLoading(true);
      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, operationCase: null, error: 'iFrame JWT token alınamadı.' });
        return;
      }

      const response = await fetch(`/api/apparel/operation-cases/${encodeURIComponent(caseId)}`, {
        cache: 'no-store',
        headers: { Authorization: 'JWT ' + iframeToken },
      });

      const raw = (await response.json()) as OperationCaseDetailResponse;
      setData(raw);
    } catch (error) {
      setData({ ok: false, fetchedAt: new Date().toISOString(), tenant: null, operationCase: null, error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const operationCase = data?.operationCase || null;
  const recommendation = useMemo(() => (operationCase ? getRecommendedAction(operationCase) : null), [operationCase]);
  const attachments = operationCase?.attachments || [];
  const events = operationCase?.events || [];

  const handleStatusChange = async (status: string) => {
    try {
      if (!operationCase) return;
      setActionError(null);
      setActionSuccess(null);
      setUpdatingStatus(true);

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setActionError('iFrame JWT token alınamadı.');
        return;
      }

      const response = await fetch(`/api/apparel/operation-cases/${operationCase.id}/status`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: 'JWT ' + iframeToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const raw = await response.json();

      if (!response.ok || !raw?.ok) {
        throw new Error(raw?.error || 'Vaka durumu güncellenemedi.');
      }

      setActionSuccess(`Vaka durumu güncellendi: ${mapStatusLabel(status)}`);
      await loadCase({ silent: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Vaka durumu güncellenirken hata oluştu.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEvidenceAction = async (action: EvidenceActionKey) => {
    try {
      if (!operationCase) return;
      setActionError(null);
      setActionSuccess(null);
      setRunningEvidenceAction(action);

      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setActionError('iFrame JWT token alınamadı.');
        return;
      }

      const selected = EVIDENCE_ACTIONS.find((item) => item.action === action);
      const response = await fetch(`/api/apparel/operation-cases/${operationCase.id}/evidence-action`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: 'JWT ' + iframeToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const raw = await response.json();

      if (!response.ok || !raw?.ok) {
        throw new Error(raw?.error || 'Kanıt aksiyonu uygulanamadı.');
      }

      setActionSuccess(`${selected?.label || 'Kanıt aksiyonu'} uygulandı.`);
      await loadCase({ silent: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Kanıt aksiyonu uygulanırken hata oluştu.');
    } finally {
      setRunningEvidenceAction(null);
    }
  };

  const handleOperatorNoteSave = async () => {
  try {
    if (!operationCase) return;

    const note = operatorNote.trim();

    setOperatorNoteError(null);
    setOperatorNoteSuccess(null);

    if (!note) {
      setOperatorNoteError('Operatör notu boş olamaz.');
      return;
    }

    setSavingOperatorNote(true);

    const iframeToken = await TokenHelpers.getTokenForIframeApp();

    if (!iframeToken) {
      setOperatorNoteError('iFrame JWT token alınamadı.');
      return;
    }

    const response = await fetch(`/api/apparel/operation-cases/${operationCase.id}/operator-note`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: 'JWT ' + iframeToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
    });

    const raw = await response.json();

    if (!response.ok || !raw?.ok) {
      throw new Error(raw?.error || 'Operatör notu kaydedilemedi.');
    }

    setOperatorNote('');
    setOperatorNoteSuccess('Operatör notu kaydedildi.');
    await loadCase({ silent: true });
  } catch (error) {
    setOperatorNoteError(error instanceof Error ? error.message : 'Operatör notu kaydedilirken hata oluştu.');
  } finally {
    setSavingOperatorNote(false);
  }
};

const handleOperatorReplySend = async () => {
  try {
    if (!operationCase) return;

    const message = operatorReply.trim();

    setOperatorReplyError(null);
    setOperatorReplySuccess(null);

    if (!message) {
      setOperatorReplyError('Müşteriye gönderilecek mesaj boş olamaz.');
      return;
    }

    setSendingOperatorReply(true);

    const iframeToken = await TokenHelpers.getTokenForIframeApp();

    if (!iframeToken) {
      setOperatorReplyError('iFrame JWT token alınamadı.');
      return;
    }

    const response = await fetch(`/api/apparel/operation-cases/${operationCase.id}/operator-reply`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: 'JWT ' + iframeToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const raw = await response.json();

    if (!response.ok || !raw?.ok) {
      throw new Error(raw?.error || 'Operatör yanıtı gönderilemedi.');
    }

    setOperatorReply('');
    setOperatorReplySuccess('Mesaj müşteriye gönderildi ve vaka geçmişine kaydedildi.');
    await loadCase({ silent: true });
  } catch (error) {
    setOperatorReplyError(error instanceof Error ? error.message : 'Operatör yanıtı gönderilirken hata oluştu.');
  } finally {
    setSendingOperatorReply(false);
  }
};
  
  const actionDisabled = updatingStatus || Boolean(runningEvidenceAction);

  return (
    <AppShell>
      <main style={{ maxWidth: 1220, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <Link href="/operations" style={{ display: 'inline-block', textDecoration: 'none', borderRadius: 10, padding: '8px 12px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 800, marginBottom: 12 }}>
              ← Operasyonlara dön
            </Link>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>
              Operasyon Vaka Merkezi
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111827', margin: '0 0 8px' }}>Operasyon Vaka Detayı</h1>
            <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7, maxWidth: 760 }}>
              Vakanın konuşma, müşteri, sipariş, CRM ve kanıt bağlantılarını tek ekranda takip edin.
            </p>
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : data?.error ? (
          <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 14, padding: 16, fontWeight: 800 }}>{data.error}</div>
        ) : !operationCase ? (
          <div style={{ border: '1px dashed #d1d5db', borderRadius: 16, padding: 20, background: '#ffffff', color: '#6b7280' }}>Operasyon vakası bulunamadı.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.85fr)', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 16 }}>
              <InfoCard title="Vaka Özeti">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  <Badge label={operationCase.caseNo || 'Vaka'} tone="info" />
                  <Badge label={mapCaseTypeLabel(operationCase.caseType)} tone="warning" />
                  <Badge label={mapStatusLabel(operationCase.status)} tone={statusTone(operationCase.status)} />
                  <Badge label={`Öncelik: ${mapPriorityLabel(operationCase.priority)}`} tone={priorityTone(operationCase.priority)} />
                  <Badge label={mapEvidenceStateLabel(operationCase.evidenceState)} tone={evidenceTone(operationCase.evidenceState)} />
                </div>

                {operationCase.customerWaId || operationCase.conversationId || operationCase.linkedOrderId ? (
  <div
    style={{
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 14,
      padding: 12,
      border: '1px solid #dbeafe',
      borderRadius: 14,
      background: '#eff6ff',
    }}
  >
    {operationCase.customerWaId ? (
      <CustomerProfileLink customerWaId={operationCase.customerWaId} />
    ) : null}

    {operationCase.conversationId ? (
      <Link
        href={`/inbox/${operationCase.conversationId}`}
        style={{
          color: '#111827',
          fontWeight: 900,
          textDecoration: 'none',
          fontSize: 13,
        }}
      >
        Konuşmaya Git →
      </Link>
    ) : null}

    {operationCase.linkedOrderId ? (
      <Link
        href={`/orders/${encodeURIComponent(operationCase.linkedOrderId)}`}
        style={{
          color: '#111827',
          fontWeight: 900,
          textDecoration: 'none',
          fontSize: 13,
        }}
      >
        Siparişe Git →
      </Link>
    ) : null}
  </div>
) : null}

                <div style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginBottom: 8 }}>{operationCase.title || 'Başlıksız operasyon vakası'}</div>
                <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7 }}>{operationCase.description || 'Açıklama bulunmuyor.'}</div>
              </InfoCard>

              <InfoCard title="Vaka Bilgileri">
                <FieldRow label="Vaka ID" value={operationCase.id} />
                <FieldRow label="Vaka No" value={operationCase.caseNo || '-'} />
                <FieldRow label="Tip" value={mapCaseTypeLabel(operationCase.caseType)} />
                <FieldRow label="Durum" value={mapStatusLabel(operationCase.status)} />
                <FieldRow label="Öncelik" value={mapPriorityLabel(operationCase.priority)} />
                <FieldRow label="Kaynak" value={operationCase.sourceChannel || '-'} />
                <FieldRow label="Oluşturulma" value={formatDate(operationCase.createdAt)} />
                <FieldRow label="Son güncelleme" value={formatDate(operationCase.updatedAt)} />
                <FieldRow label="Çözülme" value={formatDate(operationCase.resolvedAt)} />
                <FieldRow label="Kapanış" value={formatDate(operationCase.closedAt)} />
              </InfoCard>

              <InfoCard title="Vaka Geçmişi / Aksiyon Zaman Çizelgesi">
  {events.length > 0 ? (
    <div style={{ display: 'grid', gap: 10 }}>
      {events.map((event) => (
        <article
          key={event.id}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            background: '#f9fafb',
            padding: 12,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#111827', fontSize: 14, fontWeight: 900 }}>
                {event.eventLabel || event.eventType || 'Vaka aksiyonu'}
              </div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }}>
                {formatDate(event.createdAt)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge label={event.source || 'panel'} tone="info" />
              <Badge label={event.actorType || 'operator'} tone="neutral" />
            </div>
          </div>

          {event.eventNote ? (
            <div style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.6 }}>
              {event.eventNote}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <AttachmentField label="Aksiyon tipi" value={event.eventType || '-'} />
            <AttachmentField label="Aktör" value={event.actorId || '-'} />
            <AttachmentField label="Kaynak" value={event.source || '-'} />
          </div>
        </article>
      ))}
    </div>
  ) : (
    <div
      style={{
        border: '1px dashed #d1d5db',
        borderRadius: 14,
        background: '#f9fafb',
        color: '#6b7280',
        padding: 14,
        fontSize: 14,
        lineHeight: 1.7,
      }}
    >
      Bu vaka için henüz aksiyon geçmişi kaydı görünmüyor.
    </div>
  )}
</InfoCard>

              <InfoCard title="Kanıt / Medya Bilgisi">
                <FieldRow label="Kanıt durumu" value={mapEvidenceStateLabel(operationCase.evidenceState)} />
                <FieldRow label="Kanıt özeti" value={operationCase.evidenceSummary || 'Henüz kanıt özeti yok.'} />

                <div style={{ marginTop: 18, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <div>
                      <div style={{ color: '#111827', fontSize: 16, fontWeight: 900 }}>Bağlı Medya Kayıtları</div>
                      <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
                        Storage’a alınan dosyalar önizleme olarak gösterilir. Henüz yüklenmeyen kayıtlar metadata olarak kalır.
                      </div>
                    </div>
                    <Badge label={`${attachments.length} kayıt`} tone={attachments.length > 0 ? 'info' : 'neutral'} />
                  </div>

                  {attachments.length > 0 ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {attachments.map((attachment, index) => (
                        <AttachmentCard key={attachment.id || `${attachment.messageId}-${index}`} attachment={attachment} index={index} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ border: '1px dashed #d1d5db', borderRadius: 14, padding: 14, background: '#f9fafb', color: '#6b7280', fontSize: 14, lineHeight: 1.7 }}>
                      Bu vakaya bağlı medya kaydı görünmüyor. Kanıt gönderildiyse attachment meta içinde operation_case_id veya case_no eşleşmesi kontrol edilmeli.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 14 }}>
                  <Link href="/evidence" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#111827', color: '#ffffff', fontWeight: 900, display: 'inline-block' }}>
                    Kanıtlar / Medya Merkezine Git →
                  </Link>
                </div>
              </InfoCard>
            </div>

            <aside style={{ display: 'grid', gap: 16 }}>
              {recommendation ? (
                <InfoCard title="Operatör için önerilen sıradaki adım">
                  <div style={{ display: 'grid', gap: 10 }}>
                    <Badge label={recommendation.title} tone={recommendation.tone} />
                    <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.7 }}>{recommendation.helper}</div>
                  </div>
                </InfoCard>
              ) : null}

              <InfoCard title="Kanıt İnceleme Aksiyonları">
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.65 }}>
                    Bu aksiyonlar vaka durumunu ve kanıt durumunu birlikte günceller. Müşteriye otomatik mesaj göndermez; sadece operasyon kaydını düzenler.
                  </div>
                  {EVIDENCE_ACTIONS.map((item) => (
                    <div key={item.action} style={{ display: 'grid', gap: 5 }}>
                      <ActionButton label={runningEvidenceAction === item.action ? 'Uygulanıyor...' : item.label} tone={item.tone} disabled={actionDisabled} onClick={() => handleEvidenceAction(item.action)} />
                      <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.5 }}>{item.helper}</div>
                    </div>
                  ))}
                </div>
              </InfoCard>

              <InfoCard title="Müşteriye Yanıt Gönder">
  <div style={{ display: 'grid', gap: 10 }}>
    <div style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.65 }}>
      Bu alan müşteriye WhatsApp mesajı gönderir. Mesaj aynı zamanda konuşma geçmişine ve vaka geçmişine kaydedilir.
    </div>

    <div style={{ display: 'grid', gap: 8 }}>
      {OPERATOR_REPLY_TEMPLATES.map((template) => (
        <button
          key={template}
          type="button"
          onClick={() => setOperatorReply(template)}
          disabled={sendingOperatorReply}
          style={{
            border: '1px solid #d1d5db',
            borderRadius: 12,
            padding: '9px 11px',
            background: '#ffffff',
            color: '#111827',
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.5,
            cursor: sendingOperatorReply ? 'not-allowed' : 'pointer',
            textAlign: 'left',
          }}
        >
          {template}
        </button>
      ))}
    </div>

    <textarea
      value={operatorReply}
      onChange={(event) => setOperatorReply(event.target.value.slice(0, 1200))}
      disabled={sendingOperatorReply}
      placeholder="Müşteriye gönderilecek WhatsApp mesajını yazın..."
      style={{
        width: '100%',
        minHeight: 120,
        border: '1px solid #d1d5db',
        borderRadius: 12,
        padding: 12,
        background: sendingOperatorReply ? '#f3f4f6' : '#ffffff',
        color: '#111827',
        fontSize: 14,
        lineHeight: 1.6,
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />

    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>
        {operatorReply.length}/1200 karakter
      </span>

      <button
        type="button"
        onClick={handleOperatorReplySend}
        disabled={sendingOperatorReply}
        style={{
          border: 'none',
          borderRadius: 12,
          padding: '9px 13px',
          background: sendingOperatorReply ? '#9ca3af' : '#111827',
          color: '#ffffff',
          fontWeight: 900,
          cursor: sendingOperatorReply ? 'not-allowed' : 'pointer',
        }}
      >
        {sendingOperatorReply ? 'Gönderiliyor...' : 'WhatsApp Yanıtı Gönder'}
      </button>
    </div>

    {operatorReplyError ? (
      <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800 }}>
        {operatorReplyError}
      </div>
    ) : null}

    {operatorReplySuccess ? (
      <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800 }}>
        {operatorReplySuccess}
      </div>
    ) : null}
  </div>
</InfoCard>

              <InfoCard title="Operatör İç Notu">
  <div style={{ display: 'grid', gap: 10 }}>
    <div style={{ color: '#4b5563', fontSize: 13, lineHeight: 1.65 }}>
      Bu not müşteriye gönderilmez. Sadece operasyon ekibinin vaka geçmişinde görmesi için kaydedilir.
    </div>

    <textarea
      value={operatorNote}
      onChange={(event) => setOperatorNote(event.target.value.slice(0, 1200))}
      disabled={savingOperatorNote}
      placeholder="Örn: Müşteri fotoğraf gönderdi, ürün hasarlı görünüyor. İade onayı için kontrol edilmeli."
      style={{
        width: '100%',
        minHeight: 110,
        border: '1px solid #d1d5db',
        borderRadius: 12,
        padding: 12,
        background: savingOperatorNote ? '#f3f4f6' : '#ffffff',
        color: '#111827',
        fontSize: 14,
        lineHeight: 1.6,
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />

    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>
        {operatorNote.length}/1200 karakter
      </span>

      <button
        type="button"
        onClick={handleOperatorNoteSave}
        disabled={savingOperatorNote}
        style={{
          border: 'none',
          borderRadius: 12,
          padding: '9px 13px',
          background: savingOperatorNote ? '#9ca3af' : '#111827',
          color: '#ffffff',
          fontWeight: 900,
          cursor: savingOperatorNote ? 'not-allowed' : 'pointer',
        }}
      >
        {savingOperatorNote ? 'Kaydediliyor...' : 'Notu Kaydet'}
      </button>
    </div>

    {operatorNoteError ? (
      <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800 }}>
        {operatorNoteError}
      </div>
    ) : null}

    {operatorNoteSuccess ? (
      <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800 }}>
        {operatorNoteSuccess}
      </div>
    ) : null}
  </div>
</InfoCard>
              
              <InfoCard title="Durum Güncelle">
                <div style={{ display: 'grid', gap: 10 }}>
                  <select value={operationCase.status || 'open'} onChange={(event) => handleStatusChange(event.target.value)} disabled={updatingStatus} style={{ border: '1px solid #d1d5db', borderRadius: 12, padding: '10px 12px', background: updatingStatus ? '#f3f4f6' : '#ffffff', color: '#111827', fontSize: 14, fontWeight: 800, cursor: updatingStatus ? 'not-allowed' : 'pointer' }}>
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {updatingStatus ? <div style={{ color: '#6b7280', fontSize: 13 }}>Güncelleniyor...</div> : null}
                  {actionError ? <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800 }}>{actionError}</div> : null}
                  {actionSuccess ? <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 800 }}>{actionSuccess}</div> : null}
                </div>
              </InfoCard>

              <InfoCard title="Müşteri ve CRM">
                <FieldRow label="Müşteri" value={operationCase.customerWaId || '-'} />
                <div style={{ margin: '10px 0' }}>
                  <CustomerProfileLink customerWaId={operationCase.customerWaId} compact />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <Badge label={mapCrmTagLabel(operationCase.crmTag)} tone="info" />
                  <Badge label={`Risk: ${mapRiskLevelLabel(operationCase.riskLevel)}`} tone={riskTone(operationCase.riskLevel)} />
                  <Badge label={mapFollowupStatusLabel(operationCase.followupStatus)} tone={followupTone(operationCase.followupStatus)} />
                </div>
                {operationCase.crmInternalNote ? (
                  <div style={{ marginTop: 12, border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.6 }}>
                    <strong>CRM iç notu:</strong> {operationCase.crmInternalNote}
                  </div>
                ) : null}
              </InfoCard>

              <InfoCard title="Bağlı Kayıtlar">
                <div style={{ display: 'grid', gap: 10 }}>
                  {operationCase.conversationId ? <Link href={`/inbox/${operationCase.conversationId}`} style={{ textDecoration: 'none', color: '#111827', fontWeight: 900 }}>Konuşmaya Git →</Link> : <span style={{ color: '#6b7280' }}>Konuşma bağı yok</span>}
                  {operationCase.linkedOrderId ? <Link href={`/orders/${operationCase.linkedOrderId}`} style={{ textDecoration: 'none', color: '#111827', fontWeight: 900 }}>Siparişe Git →</Link> : <span style={{ color: '#6b7280' }}>Sipariş bağı yok</span>}
                  <Link href="/operations" style={{ textDecoration: 'none', color: '#111827', fontWeight: 900 }}>Operasyonlar Listesine Git →</Link>
                  <Link href="/operator-actions" style={{ textDecoration: 'none', color: '#111827', fontWeight: 900 }}>Aksiyon Merkezine Git →</Link>
                </div>
              </InfoCard>
            </aside>
          </div>
        )}
      </main>
    </AppShell>
  );
}
