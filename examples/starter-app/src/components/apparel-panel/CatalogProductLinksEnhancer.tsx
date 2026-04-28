'use client';

import { useEffect } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import type { ProductsListResponse } from '@/lib/apparel-panel/types';

function normalizeText(value: string | null | undefined) {
  return String(value || '').trim();
}

function findProductRow(handle: string | null, name: string) {
  const rows = Array.from(document.querySelectorAll('tbody tr'));

  return rows.find((row) => {
    const text = normalizeText(row.textContent);
    return Boolean(
      (handle && text.includes(handle)) ||
      (name && text.includes(name)),
    );
  }) as HTMLTableRowElement | undefined;
}

function ensureLinkCell(row: HTMLTableRowElement, productId: string) {
  const existing = row.querySelector('[data-catalog-product-detail-link="true"]');
  if (existing) return;

  const firstCell = row.querySelector('td');
  if (!firstCell) return;

  const link = document.createElement('a');
  link.href = `/catalog/${encodeURIComponent(productId)}`;
  link.textContent = 'Detay →';
  link.setAttribute('data-catalog-product-detail-link', 'true');
  link.style.display = 'inline-flex';
  link.style.width = 'fit-content';
  link.style.marginTop = '6px';
  link.style.textDecoration = 'none';
  link.style.fontSize = '12px';
  link.style.fontWeight = '900';
  link.style.color = '#111827';
  link.style.border = '1px solid #e5e7eb';
  link.style.borderRadius = '999px';
  link.style.padding = '4px 8px';
  link.style.background = '#ffffff';

  firstCell.appendChild(link);
}

export function CatalogProductLinksEnhancer() {
  useEffect(() => {
    let cancelled = false;

    const enhance = async () => {
      try {
        const iframeToken = await TokenHelpers.getTokenForIframeApp();
        if (!iframeToken || cancelled) return;

        const response = await fetch('/api/apparel/products', {
          cache: 'no-store',
          headers: { Authorization: 'JWT ' + iframeToken },
        });

        const raw = (await response.json()) as ProductsListResponse;
        const items = raw?.items || [];

        items.forEach((product) => {
          const row = findProductRow(product.handle, product.name);
          if (row) ensureLinkCell(row, product.id);
        });
      } catch {
        // Enhancement only. Catalog list remains usable even if links cannot be mounted.
      }
    };

    enhance();
    const timer = window.setTimeout(enhance, 500);

    const observer = new MutationObserver(() => {
      enhance();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
