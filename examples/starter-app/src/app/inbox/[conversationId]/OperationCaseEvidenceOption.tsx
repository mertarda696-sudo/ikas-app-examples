'use client';

import type { ConversationMessageItem } from '@/lib/apparel-panel/types';

type EvidenceKind = 'image' | 'video' | 'audio' | 'document' | 'link';

type EvidenceOption = {
  kind: EvidenceKind;
  label: string;
  summary: string;
};

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/i;

function getEvidenceLabel(kind: EvidenceKind) {
  if (kind === 'image') return 'görsel';
  if (kind === 'video') return 'video';
  if (kind === 'audio') return 'sesli mesaj';
  if (kind === 'document') return 'doküman';
  return 'link';
}

function getEvidenceKindFromMessage(message: ConversationMessageItem): EvidenceKind | null {
  const msgType = String(message.msgType || '').toLowerCase();

  if (msgType === 'image') return 'image';
  if (msgType === 'video') return 'video';
  if (msgType === 'audio') return 'audio';
  if (msgType === 'document') return 'document';

  if (msgType === 'text' && URL_RE.test(String(message.textBody || ''))) {
    return 'link';
  }

  return null;
}

export function getLatestEvidenceOption(messages: ConversationMessageItem[] | undefined): EvidenceOption | null {
  const latestCustomerMessage = [...(messages || [])]
    .reverse()
    .find((message) => message.senderType === 'customer' || message.direction === 'in');

  if (!latestCustomerMessage) return null;

  const kind = getEvidenceKindFromMessage(latestCustomerMessage);
  if (!kind) return null;

  const label = getEvidenceLabel(kind);

  return {
    kind,
    label,
    summary: `Müşteri konuşma içinde ${label} gönderdi. Operatör tarafından kanıt olarak işaretlendi.`,
  };
}

export function OperationCaseEvidenceOption({
  evidenceOption,
  checked,
  onCheckedChange,
}: {
  evidenceOption: EvidenceOption | null;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  if (!evidenceOption) return null;

  return (
    <div
      style={{
        marginTop: 12,
        border: '1px solid #fde68a',
        background: '#fffbeb',
        borderRadius: 14,
        padding: 12,
        display: 'grid',
        gap: 8,
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          style={{ marginTop: 3 }}
        />

        <span style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#92400e' }}>
            Son {evidenceOption.label} mesajını bu operasyon için kanıt olarak işaretle
          </span>
          <span style={{ fontSize: 12, lineHeight: 1.55, color: '#92400e' }}>
            Bu içerik otomatik kanıt sayılmaz. Yalnızca bu kutu işaretlenirse oluşturulan operasyon kaydı kanıt durumuyla açılır.
          </span>
        </span>
      </label>
    </div>
  );
}
