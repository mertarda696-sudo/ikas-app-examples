'use client';

import { useEffect } from 'react';

const ACTION_LABELS = [
  'Kanıtı Doğrula',
  'Ek Kanıt İste',
  'Kanıt Yetersiz',
  'İncelemeye Al',
  'Çözüldü Yap',
];

function findCardByTitle(titleText: string) {
  const nodes = Array.from(document.querySelectorAll('div'));
  const title = nodes.find((node) => String(node.textContent || '').trim() === titleText);
  return title?.parentElement || null;
}

function ensureFeedbackBox(card: Element) {
  const id = 'operation-case-action-feedback-box';
  let box = document.getElementById(id);

  if (!box) {
    box = document.createElement('div');
    box.id = id;
    box.style.borderRadius = '12px';
    box.style.padding = '10px 12px';
    box.style.fontSize = '13px';
    box.style.fontWeight = '900';
    box.style.lineHeight = '1.55';
    box.style.marginBottom = '10px';
  }

  const grid = card.querySelector('div[style*="display: grid"]') || card;

  if (box.parentElement !== grid) {
    grid.insertBefore(box, grid.children[1] || null);
  }

  return box;
}

function setFeedback(kind: 'saving' | 'success' | 'error', text: string) {
  const card = findCardByTitle('Kanıt İnceleme Aksiyonları');
  if (!card) return;

  const box = ensureFeedbackBox(card);

  if (kind === 'success') {
    box.style.border = '1px solid #bbf7d0';
    box.style.background = '#f0fdf4';
    box.style.color = '#166534';
    box.textContent = `✅ ${text}`;
    return;
  }

  if (kind === 'error') {
    box.style.border = '1px solid #fecaca';
    box.style.background = '#fef2f2';
    box.style.color = '#991b1b';
    box.textContent = `⚠️ ${text}`;
    return;
  }

  box.style.border = '1px solid #bfdbfe';
  box.style.background = '#eff6ff';
  box.style.color = '#1d4ed8';
  box.textContent = `⏳ ${text}`;
}

function findActionResultText(lastActionLabel: string | null) {
  if (!lastActionLabel) return null;

  const nodes = Array.from(document.querySelectorAll('div'));
  const expected = `${lastActionLabel} uygulandı.`;

  const success = nodes.find((node) => String(node.textContent || '').trim() === expected);
  if (success) return { kind: 'success' as const, text: expected };

  const error = nodes.find((node) => String(node.textContent || '').includes('Kanıt aksiyonu') && String(node.textContent || '').includes('hata'));
  if (error) return { kind: 'error' as const, text: String(error.textContent || '').trim() };

  return null;
}

export function OperationCaseActionFeedbackEnhancer() {
  useEffect(() => {
    let lastActionLabel: string | null = null;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      const label = String(button?.textContent || '').trim();
      const actionLabel = ACTION_LABELS.find((candidate) => label === candidate || label.includes(candidate));

      if (!actionLabel) return;

      lastActionLabel = actionLabel;
      setFeedback('saving', `${actionLabel} uygulanıyor...`);
    };

    const observer = new MutationObserver(() => {
      const result = findActionResultText(lastActionLabel);
      if (!result) return;

      setFeedback(result.kind, result.text);
    });

    document.addEventListener('click', handleClick, true);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      document.removeEventListener('click', handleClick, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
