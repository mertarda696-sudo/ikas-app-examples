'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';

function addCaseLinks() {
  const labels = Array.from(document.querySelectorAll('span'));

  labels.forEach((label) => {
    const caseNo = String(label.textContent || '').trim();
    if (!caseNo.startsWith('OP-')) return;

    const parent = label.parentElement;
    if (!parent || parent.querySelector('.customer-case-detail-link')) return;

    const link = document.createElement('a');
    link.className = 'customer-case-detail-link';
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

export default function CustomerProfileLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname?.startsWith('/customers/')) return;

    addCaseLinks();

    const observer = new MutationObserver(() => addCaseLinks());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return children;
}
