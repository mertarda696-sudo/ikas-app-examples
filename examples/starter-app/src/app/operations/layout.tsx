'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';

function applyOperationDetailLinks() {
  const rows = document.querySelectorAll('table tbody tr');

  rows.forEach((row) => {
    const firstCell = row.querySelector('td');

    if (!firstCell || firstCell.querySelector('[data-operation-detail-link="true"]')) {
      return;
    }

    const caseNo = String(firstCell.textContent || '').trim();

    if (!caseNo || caseNo === '-') {
      return;
    }

    firstCell.style.fontWeight = '700';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'grid';
    wrapper.style.gap = '6px';

    const label = document.createElement('span');
    label.textContent = caseNo;
    label.style.fontWeight = '700';

    const link = document.createElement('a');
    link.dataset.operationDetailLink = 'true';
    link.href = `/operations/${encodeURIComponent(caseNo)}`;
    link.textContent = 'Vaka Detayına Git →';
    link.style.textDecoration = 'none';
    link.style.color = '#2563eb';
    link.style.fontSize = '12px';
    link.style.fontWeight = '800';

    wrapper.appendChild(label);
    wrapper.appendChild(link);

    firstCell.textContent = '';
    firstCell.appendChild(wrapper);
  });
}

export default function OperationsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/operations') return;

    applyOperationDetailLinks();

    const observer = new MutationObserver(() => {
      applyOperationDetailLinks();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  return children;
}
