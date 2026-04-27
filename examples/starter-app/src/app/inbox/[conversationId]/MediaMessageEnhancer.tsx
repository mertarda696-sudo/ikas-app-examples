'use client';

import { useEffect } from 'react';

type MediaKind = 'audio' | 'video' | 'image' | 'document';

function getMediaKind(label: string): MediaKind | null {
  const normalized = label.toLowerCase();

  if (normalized.includes('· ses')) return 'audio';
  if (normalized.includes('· video')) return 'video';
  if (normalized.includes('· görsel')) return 'image';
  if (normalized.includes('· doküman')) return 'document';

  return null;
}

function getMediaCopy(kind: MediaKind) {
  if (kind === 'audio') {
    return {
      title: 'Sesli mesaj',
      body: 'Bu sesli mesaj konuşma akışına alındı. Oynatma ve transkript desteği medya ingestion fazında eklenecek.',
      badge: 'Mesaj medyası',
    };
  }

  if (kind === 'video') {
    return {
      title: 'Video mesajı',
      body: 'Bu video mesajı konuşma akışına alındı. Operasyon kanıtıysa vaka detayına ayrıca bağlanabilir.',
      badge: 'Video',
    };
  }

  if (kind === 'image') {
    return {
      title: 'Görsel mesaj',
      body: 'Bu görsel konuşma akışına alındı. Hasar, dekont veya iade kanıtı ise ilgili operasyon vakasına bağlanabilir.',
      badge: 'Görsel',
    };
  }

  return {
    title: 'Doküman / PDF',
    body: 'Bu doküman konuşma akışına alındı. Fatura, dekont veya kargo etiketi ise ilgili operasyon vakasına bağlanabilir.',
    badge: 'Doküman',
  };
}

function addMediaCards() {
  const headers = Array.from(document.querySelectorAll('div'));

  headers.forEach((header) => {
    const headerText = String(header.textContent || '').trim();
    const kind = getMediaKind(headerText);

    if (!kind) return;

    const bubble = header.parentElement;
    if (!bubble || bubble.querySelector('[data-media-message-card="true"]')) return;

    const copy = getMediaCopy(kind);

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

export function MediaMessageEnhancer() {
  useEffect(() => {
    addMediaCards();

    const observer = new MutationObserver(() => addMediaCards());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
