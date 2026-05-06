'use client';

import { useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import OrderSyncButton from '@/components/apparel-panel/OrderSyncButton';

type SyncState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  detail?: string;
};

export default function CatalogSyncButton() {
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    message: '',
  });

  async function handleSync() {
    setState({
      status: 'loading',
      message: 'ikas katalog sync kuyruğu başlatılıyor...',
    });

    try {
      const iframeToken = await TokenHelpers.getTokenForIframeApp();

      if (!iframeToken) {
        setState({
          status: 'error',
          message: 'Katalog sync başlatılamadı.',
          detail: 'iFrame JWT token alınamadı.',
        });
        return;
      }

      const response = await fetch('/api/ikas/sync-products-to-queue', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: 'JWT ' + iframeToken,
        },
      });

      const rawText = await response.text();
      let payload: any = {};

      try {
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        payload = {
          ok: false,
          error: rawText || `HTTP ${response.status} ${response.statusText}`,
        };
      }

      if (!response.ok || !payload?.ok) {
        setState({
          status: 'error',
          message: 'Katalog sync başlatılamadı.',
          detail:
            payload?.message ||
            payload?.error ||
            `HTTP ${response.status} ${response.statusText}`,
        });
        return;
      }

      setState({
        status: 'success',
        message: 'ikas katalog sync kuyruğu başlatıldı.',
        detail: `Kuyruğa alınan/güncellenen kayıt: ${payload?.queuedCount ?? 0}`,
      });
    } catch (error) {
      setState({
        status: 'error',
        message: 'Katalog sync sırasında beklenmeyen hata oluştu.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const isLoading = state.status === 'loading';

  return (
    <>
      <section
        style={{
          display: 'grid',
          gap: 10,
          padding: 16,
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          marginTop: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: 15, color: '#111827' }}>
            ikas katalog yenileme
          </strong>
          <span style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
            ikas ürün, varyant, fiyat ve stok verisini Supabase katalog kuyruğuna yeniden alır.
            Sonrasında n8n CATALOG IMPORT PROCESS worker ile ürün/varyant tabloları güncellenir.
          </span>
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={isLoading}
          style={{
            width: 'fit-content',
            border: 'none',
            borderRadius: 999,
            padding: '10px 14px',
            background: isLoading ? '#9ca3af' : '#111827',
            color: '#fff',
            fontWeight: 800,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Sync başlatılıyor...' : 'ikas Kataloğunu Yenile'}
        </button>

        {state.message ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background:
                state.status === 'success'
                  ? '#ecfdf5'
                  : state.status === 'error'
                    ? '#fef2f2'
                    : '#f9fafb',
              border:
                state.status === 'success'
                  ? '1px solid #a7f3d0'
                  : state.status === 'error'
                    ? '1px solid #fecaca'
                    : '1px solid #e5e7eb',
              color:
                state.status === 'success'
                  ? '#065f46'
                  : state.status === 'error'
                    ? '#991b1b'
                    : '#374151',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong>{state.message}</strong>
            {state.detail ? <div>{state.detail}</div> : null}
          </div>
        ) : null}
      </section>

      <OrderSyncButton />
    </>
  );
}
