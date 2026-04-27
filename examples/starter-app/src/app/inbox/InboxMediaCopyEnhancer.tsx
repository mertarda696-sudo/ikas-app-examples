'use client';

import { useEffect } from 'react';

const DEFAULT_REPLY_HELPER =
  'Müşteriye AI cevap vermiş olabilir; operatör manuel yanıt vermediği veya incelemediği için bu konuşma hâlâ yanıt kuyruğunda.';

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/i;

type InboxMediaCopy = {
  placeholderLine: string;
  displayLine: string;
  helper: string;
};

const MEDIA_COPIES: InboxMediaCopy[] = [
  {
    placeholderLine: 'Müşteri: Görsel mesaj alındı.',
    displayLine: 'Müşteri görsel gönderdi.',
    helper:
      'Müşteri görsel gönderdi. Operatör görseli inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
  },
  {
    placeholderLine: 'Müşteri: Sesli mesaj alındı.',
    displayLine: 'Müşteri sesli mesaj gönderdi.',
    helper:
      'Müşteri sesli mesaj gönderdi. Operatör sesli mesajı inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
  },
  {
    placeholderLine: 'Müşteri: Video mesajı alındı.',
    displayLine: 'Müşteri video gönderdi.',
    helper:
      'Müşteri video gönderdi. Operatör videoyu inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
  },
  {
    placeholderLine: 'Müşteri: Doküman alındı.',
    displayLine: 'Müşteri doküman gönderdi.',
    helper:
      'Müşteri doküman gönderdi. Operatör dokümanı inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
  },
];

function isInboxListPage() {
  return window.location.pathname === '/inbox';
}

function findInboxCard(node: Element) {
  let current: Element | null = node;

  for (let depth = 0; depth < 8 && current; depth += 1) {
    const text = String(current.textContent || '');
    if (text.includes('Operatör için önerilen aksiyon') && text.includes('Konuşma Detayına Git')) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function replaceExactTextInside(root: Element, from: string, to: string) {
  const nodes = Array.from(root.querySelectorAll('div'));

  nodes.forEach((node) => {
    if (String(node.textContent || '').trim() === from) {
      node.textContent = to;
    }
  });
}

function applyInboxMediaCopy() {
  if (!isInboxListPage()) return;

  const nodes = Array.from(document.querySelectorAll('div'));

  MEDIA_COPIES.forEach((copy) => {
    nodes.forEach((node) => {
      if (String(node.textContent || '').trim() !== copy.placeholderLine) return;

      const card = findInboxCard(node);
      if (!card) return;

      node.textContent = copy.displayLine;
      replaceExactTextInside(card, DEFAULT_REPLY_HELPER, copy.helper);
    });
  });
}

function applyInboxLinkCopy() {
  if (!isInboxListPage()) return;

  const nodes = Array.from(document.querySelectorAll('div'));

  nodes.forEach((node) => {
    const text = String(node.textContent || '').trim();
    if (!text.startsWith('Müşteri: ')) return;
    if (!URL_RE.test(text)) return;

    const card = findInboxCard(node);
    if (!card) return;

    node.textContent = 'Müşteri link gönderdi.';
    replaceExactTextInside(
      card,
      DEFAULT_REPLY_HELPER,
      'Müşteri link gönderdi. Operatör bağlantıyı inceleyip manuel yanıt verebilir veya konuşmayı incelendi olarak işaretleyebilir.',
    );
  });
}

function applyInboxEnhancements() {
  applyInboxMediaCopy();
  applyInboxLinkCopy();
}

export function InboxMediaCopyEnhancer() {
  useEffect(() => {
    applyInboxEnhancements();

    const observer = new MutationObserver(() => applyInboxEnhancements());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
