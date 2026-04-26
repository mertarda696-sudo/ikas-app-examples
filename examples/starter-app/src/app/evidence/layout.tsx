'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';

function applyEvidenceOperationDetailLinks() {
  const pills = Array.from(document.querySelectorAll('span'));

  pills.forEach((pill) => {
    const caseNo = String(pill.textContent || '').trim();

    if (!caseNo.startsWith('OP-')) return;

    const parent = pill.parentElement;
    if (!parent || parent.querySelector(`[data-evidence-operation-detail-link="${caseNo}"]`)) {
      return;
    }

    const link = document.createElement('a');
    link.dataset.evidenceOperationDetailLink = caseNo;
    link.href = `/operations/${encodeURIComponent(caseNo)}`;
    link.textContent = 'Vaka Detayına Git →';
    link.style.textDecoration = 'none';
    link.style.color = '#2563eb';
    link.style.fontSize = '12px';
    link.style.fontWeight = '900';
    link.style.display = 'inline-flex';
    link.style.alignItems = 'center';
    link.style.borderRadius = '999px';
    link.style.padding = '5px 10px';
    link.style.background = '#eff6ff';

    parent.appendChild(link);
  });
}

export default function EvidenceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/evidence') return;

    applyEvidenceOperationDetailLinks();

    const observer = new MutationObserver(() => {
      applyEvidenceOperationDetailLinks();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  return children;
}
