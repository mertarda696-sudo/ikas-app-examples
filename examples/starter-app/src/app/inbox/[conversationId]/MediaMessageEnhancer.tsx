'use client';

import { useEffect } from 'react';

type MessageKind = 'audio' | 'video' | 'image' | 'document' | 'link';

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/i;
const MESSAGE_HEADER_RE = /^(müşteri|ai asistan|operatör|sistem) · (metin|görsel|video|ses|doküman|bilinmiyor)$/i;

function isExactMessageHeader(node: Element) {
  const text = String(node.textContent || '').trim().toLowerCase();
  return MESSAGE_HEADER_RE.test(text);
}

function getNearText(header?: Element) {
  if (!header) return '';

  const parts: string[] = [];
  let current: Element | null = header;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    parts.push(String(current.textContent || ''));
    if (current.nextElementSibling) parts.push(String(current.nextElementSibling.textContent || ''));
    if (current.previousElementSibling) parts.push(String(current.previousElementSibling.textContent || ''));
    current = current.parentElement;
  }

  return parts.join(' ');
}

function getMessageKindFromHeader(label: string, header?: Element): MessageKind | null {
  const normalized = label.toLowerCase();

  if (normalized.includes('· ses')) return 'audio';
  if (normalized.includes('· video')) return 'video';
  if (normalized.includes('· görsel')) return 'image';
  if (normalized.includes('· doküman')) return 'document';

  if (normalized.includes('· metin') && header) {
    const nearbyText = getNearText(header);
    if (URL_RE.test(nearbyText)) return 'link';
  }

  return null;
}

function getMessageCopy(kind: MessageKind) {
  if (kind === 'audio') {
    return {
      title: 'Sesli mesaj',
      body: 'Bu sesli mesaj konuşma akışına alındı. Oynatma ve transkript desteği medya ingestion fazında eklenecek.',
      badge: 'Mesaj medyası',
      reviewTitle: 'Sesli mesaj incelendiyse müşteriye mesaj göndermeden kuyruğu temizleyebilirsiniz.',
      reviewHelper: 'Bu işlem WhatsApp mesajı göndermez; yalnızca sesli mesajın operatör tarafından incelendiğini işaretler.',
      operatorHelper: 'Müşteri sesli mesaj gönderdi. Operatör sesli mesajı inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
      flowHelper: 'Sesli mesaj incelendiyse “İncelendi olarak işaretle”; dönüş gerekiyorsa manuel cevap gönder.',
    };
  }

  if (kind === 'video') {
    return {
      title: 'Video mesajı',
      body: 'Bu video mesajı konuşma akışına alındı. Operasyon kanıtıysa vaka detayına ayrıca bağlanabilir.',
      badge: 'Video',
      reviewTitle: 'Video mesajı incelendiyse müşteriye mesaj göndermeden kuyruğu temizleyebilirsiniz.',
      reviewHelper: 'Bu işlem WhatsApp mesajı göndermez; yalnızca video mesajının operatör tarafından incelendiğini işaretler.',
      operatorHelper: 'Müşteri video gönderdi. Operatör videoyu inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
      flowHelper: 'Video incelendiyse “İncelendi olarak işaretle”; dönüş gerekiyorsa manuel cevap gönder.',
    };
  }

  if (kind === 'image') {
    return {
      title: 'Görsel mesaj',
      body: 'Bu görsel konuşma akışına alındı. Hasar, dekont veya iade kanıtı ise ilgili operasyon vakasına bağlanabilir.',
      badge: 'Görsel',
      reviewTitle: 'Görsel mesaj incelendiyse müşteriye mesaj göndermeden kuyruğu temizleyebilirsiniz.',
      reviewHelper: 'Bu işlem WhatsApp mesajı göndermez; yalnızca görselin operatör tarafından incelendiğini işaretler.',
      operatorHelper: 'Müşteri görsel gönderdi. Operatör görseli inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
      flowHelper: 'Görsel incelendiyse “İncelendi olarak işaretle”; dönüş gerekiyorsa manuel cevap gönder.',
    };
  }

  if (kind === 'link') {
    return {
      title: 'Link mesajı',
      body: 'Bu link konuşma akışına alındı. Operatör bağlantıyı inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
      badge: 'Link',
      reviewTitle: 'Link incelendiyse müşteriye mesaj göndermeden kuyruğu temizleyebilirsiniz.',
      reviewHelper: 'Bu işlem WhatsApp mesajı göndermez; yalnızca linkin operatör tarafından incelendiğini işaretler.',
      operatorHelper: 'Müşteri link gönderdi. Operatör bağlantıyı inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
      flowHelper: 'Link incelendiyse “İncelendi olarak işaretle”; dönüş gerekiyorsa manuel cevap gönder.',
    };
  }

  return {
    title: 'Doküman / PDF',
    body: 'Bu doküman konuşma akışına alındı. Fatura, dekont veya kargo etiketi ise ilgili operasyon vakasına bağlanabilir.',
    badge: 'Doküman',
    reviewTitle: 'Doküman incelendiyse müşteriye mesaj göndermeden kuyruğu temizleyebilirsiniz.',
    reviewHelper: 'Bu işlem WhatsApp mesajı göndermez; yalnızca dokümanın operatör tarafından incelendiğini işaretler.',
    operatorHelper: 'Müşteri doküman gönderdi. Operatör dokümanı inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
    flowHelper: 'Doküman incelendiyse “İncelendi olarak işaretle”; dönüş gerekiyorsa manuel cevap gönder.',
  };
}

function getEvidenceLabel(kind: MessageKind) {
  if (kind === 'image') return 'görsel';
  if (kind === 'video') return 'video';
  if (kind === 'audio') return 'sesli mesaj';
  if (kind === 'document') return 'doküman';
  return 'link';
}

function getEvidenceSummary(kind: MessageKind) {
  const label = getEvidenceLabel(kind);
  return `Müşteri konuşma içinde ${label} gönderdi. Operatör tarafından kanıt olarak işaretlendi.`;
}

function findMessageAreaFromHeader(header: Element) {
  const bubble = header.parentElement;
  const row = bubble?.parentElement;
  const messageArea = row?.parentElement;

  return messageArea instanceof HTMLElement ? messageArea : null;
}

function makeMessageAreaScrollable(messageArea: HTMLElement | null) {
  if (!messageArea) return;

  messageArea.dataset.scrollableConversationMessages = 'true';
  messageArea.style.maxHeight = '620px';
  messageArea.style.overflowY = 'auto';
  messageArea.style.overscrollBehavior = 'contain';
  messageArea.style.paddingRight = '10px';
  messageArea.style.scrollBehavior = 'smooth';

  window.setTimeout(() => {
    messageArea.scrollTop = messageArea.scrollHeight;
  }, 100);
}

function applyScrollableMessageArea() {
  const messageHeaders = Array.from(document.querySelectorAll('div')).filter(isExactMessageHeader);
  const firstHeader = messageHeaders[0];
  const messageArea = firstHeader ? findMessageAreaFromHeader(firstHeader) : null;

  makeMessageAreaScrollable(messageArea);
}

function getLatestCustomerMessageKind() {
  const messageHeaders = Array.from(document.querySelectorAll('div')).filter(isExactMessageHeader);
  const lastHeader = [...messageHeaders].reverse().find((header) =>
    String(header.textContent || '').trim().toLowerCase().startsWith('müşteri ·'),
  );

  return lastHeader ? getMessageKindFromHeader(String(lastHeader.textContent || ''), lastHeader) : null;
}

function replaceExactText(from: string, to: string) {
  const nodes = Array.from(document.querySelectorAll('div'));

  nodes.forEach((node) => {
    if (String(node.textContent || '').trim() === from) {
      node.textContent = to;
    }
  });
}

function applyMessageAwareOperatorCopy() {
  const kind = getLatestCustomerMessageKind();
  if (!kind) return;

  const copy = getMessageCopy(kind);

  replaceExactText(
    'AI cevabı yeterliyse müşteriye tekrar mesaj göndermeden kuyruğu temizleyebilirsiniz.',
    copy.reviewTitle,
  );
  replaceExactText(
    'Bu işlem WhatsApp mesajı göndermez; yalnızca konuşmayı operatör tarafından incelendi olarak işaretler.',
    copy.reviewHelper,
  );
  replaceExactText(
    'Müşteriye AI cevap vermiş olabilir; operatör manuel yanıt vermediği veya incelemediği için bu konuşma hâlâ yanıt kuyruğunda.',
    copy.operatorHelper,
  );
  replaceExactText(
    'AI cevabı yeterliyse “İncelendi olarak işaretle”; değilse manuel cevap gönder.',
    copy.flowHelper,
  );
}

function addMessageCards() {
  const headers = Array.from(document.querySelectorAll('div')).filter(isExactMessageHeader);

  headers.forEach((header) => {
    const headerText = String(header.textContent || '').trim();
    const kind = getMessageKindFromHeader(headerText, header);

    if (!kind) return;

    const bubble = header.parentElement;
    if (!bubble || bubble.querySelector('[data-media-message-card="true"]')) return;

    const copy = getMessageCopy(kind);

    const card = document.createElement('div');
    card.dataset.mediaMessageCard = 'true';
    card.style.marginTop = '10px';
    card.style.border = '1px solid #bfdbfe';
    card.style.background = '#eff6ff';
    card.style.borderRadius = '14px';
    card.style.padding = '10px';
    card.style.display = 'grid';
    card.style.gap = '6px';

    const topLine = document.createElement('div');
    topLine.style.display = 'flex';
    topLine.style.justifyContent = 'space-between';
    topLine.style.alignItems = 'center';
    topLine.style.gap = '8px';
    topLine.style.flexWrap = 'wrap';

    const title = document.createElement('div');
    title.textContent = copy.title;
    title.style.fontSize = '13px';
    title.style.fontWeight = '900';
    title.style.color = '#1e3a8a';

    const badge = document.createElement('span');
    badge.textContent = copy.badge;
    badge.style.borderRadius = '999px';
    badge.style.background = '#dbeafe';
    badge.style.color = '#1d4ed8';
    badge.style.padding = '4px 8px';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '900';

    const body = document.createElement('div');
    body.textContent = copy.body;
    body.style.fontSize = '12px';
    body.style.lineHeight = '1.55';
    body.style.color = '#1d4ed8';

    topLine.appendChild(title);
    topLine.appendChild(badge);
    card.appendChild(topLine);
    card.appendChild(body);

    const genericNote = Array.from(bubble.querySelectorAll('div')).find((node) =>
      String(node.textContent || '').trim() === 'Medya / kanıt içeriği mevcut olabilir',
    );

    if (genericNote) {
      genericNote.replaceWith(card);
      return;
    }

    bubble.appendChild(card);
  });
}

function findOperationCaseSection() {
  const candidates = Array.from(document.querySelectorAll('section, div')).filter((node) => {
    const text = String(node.textContent || '');
    return (
      text.includes('Operasyon Kaydı Oluştur') &&
      text.includes('Vaka tipi') &&
      text.includes('Operasyon kaydı oluştur')
    );
  });

  return candidates
    .filter((node): node is HTMLElement => node instanceof HTMLElement)
    .sort((a, b) => String(a.textContent || '').length - String(b.textContent || '').length)[0] || null;
}

function applyManualEvidenceBox() {
  const kind = getLatestCustomerMessageKind();
  const existing = document.querySelector<HTMLElement>('[data-manual-evidence-box="true"]');

  if (!kind) {
    existing?.remove();
    return;
  }

  const section = findOperationCaseSection();
  if (!section) return;

  if (existing) {
    const checkbox = existing.querySelector<HTMLInputElement>('input[data-manual-evidence-checkbox="true"]');
    if (checkbox) checkbox.dataset.evidenceKind = kind;
    const label = existing.querySelector<HTMLElement>('[data-manual-evidence-label="true"]');
    if (label) label.textContent = `Son ${getEvidenceLabel(kind)} mesajını bu operasyon için kanıt olarak işaretle`;
    return;
  }

  const box = document.createElement('div');
  box.dataset.manualEvidenceBox = 'true';
  box.style.marginTop = '12px';
  box.style.border = '1px solid #fde68a';
  box.style.background = '#fffbeb';
  box.style.borderRadius = '14px';
  box.style.padding = '12px';
  box.style.display = 'grid';
  box.style.gap = '8px';

  const row = document.createElement('label');
  row.style.display = 'flex';
  row.style.alignItems = 'flex-start';
  row.style.gap = '10px';
  row.style.cursor = 'pointer';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.manualEvidenceCheckbox = 'true';
  checkbox.dataset.evidenceKind = kind;
  checkbox.style.marginTop = '3px';

  const textWrap = document.createElement('div');
  textWrap.style.display = 'grid';
  textWrap.style.gap = '4px';

  const title = document.createElement('div');
  title.dataset.manualEvidenceLabel = 'true';
  title.textContent = `Son ${getEvidenceLabel(kind)} mesajını bu operasyon için kanıt olarak işaretle`;
  title.style.fontSize = '13px';
  title.style.fontWeight = '900';
  title.style.color = '#92400e';

  const helper = document.createElement('div');
  helper.textContent = 'Bu içerik otomatik kanıt sayılmaz. Yalnızca bu kutu işaretlenirse oluşturulan operasyon kaydı kanıt durumuyla açılır.';
  helper.style.fontSize = '12px';
  helper.style.lineHeight = '1.55';
  helper.style.color = '#92400e';

  textWrap.appendChild(title);
  textWrap.appendChild(helper);
  row.appendChild(checkbox);
  row.appendChild(textWrap);
  box.appendChild(row);

  section.appendChild(box);
}

function getManualEvidencePayload() {
  const checkbox = document.querySelector<HTMLInputElement>('input[data-manual-evidence-checkbox="true"]');
  if (!checkbox?.checked) return null;

  const kind = checkbox.dataset.evidenceKind as MessageKind | undefined;
  if (!kind) return null;

  return {
    evidenceState: 'received',
    evidenceSummary: getEvidenceSummary(kind),
  };
}

function patchOperationCaseFetch() {
  const win = window as typeof window & {
    __manualEvidenceFetchPatched?: boolean;
  };

  if (win.__manualEvidenceFetchPatched) return;

  const originalFetch = window.fetch.bind(window);
  win.__manualEvidenceFetchPatched = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = String(init?.method || 'GET').toUpperCase();

    if (
      method === 'POST' &&
      url.includes('/api/apparel/conversations/') &&
      url.includes('/operation-case') &&
      typeof init?.body === 'string'
    ) {
      const evidencePayload = getManualEvidencePayload();

      if (evidencePayload) {
        try {
          const parsed = JSON.parse(init.body);
          return originalFetch(input, {
            ...init,
            body: JSON.stringify({
              ...parsed,
              evidenceState: parsed.evidenceState || evidencePayload.evidenceState,
              evidenceSummary: parsed.evidenceSummary || evidencePayload.evidenceSummary,
            }),
          });
        } catch {
          return originalFetch(input, init);
        }
      }
    }

    return originalFetch(input, init);
  };
}

export function MediaMessageEnhancer() {
  useEffect(() => {
    patchOperationCaseFetch();
    applyScrollableMessageArea();
    addMessageCards();
    applyMessageAwareOperatorCopy();
    applyManualEvidenceBox();

    const observer = new MutationObserver(() => {
      applyScrollableMessageArea();
      addMessageCards();
      applyMessageAwareOperatorCopy();
      applyManualEvidenceBox();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
