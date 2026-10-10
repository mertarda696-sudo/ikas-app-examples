'use client';

import { useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';

type SyncState = {
  status: 'idle' | 'loading' | 'success' | 'warning' | 'error';
  message: string;
  detail?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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
      let payload: Record<string, unknown> = {};

      try {
        const parsed: unknown = rawText ? JSON.parse(rawText) : {};
        payload = isRecord(parsed) ? parsed : {};
      } catch {
        payload = {
          ok: false,
          error: rawText || 'HTTP ' + response.status + ' ' + response.statusText,
        };
      }

      if (!response.ok || payload.ok !== true) {
        const detail =
          typeof payload.message === 'string'
            ? payload.message
            : typeof payload.error === 'string'
              ? payload.error
              : 'HTTP ' + response.status + ' ' + response.statusText;

        setState({
          status: 'error',
          message: 'Katalog sync başlatılamadı.',
          detail,
        });
        return;
      }

      const importTrigger = isRecord(payload.importTrigger)
        ? payload.importTrigger
        : null;
      const runId = typeof payload.runId === 'string' ? payload.runId : 'bilinmiyor';
      const queuedCount =
        typeof payload.queuedCount === 'number' ? payload.queuedCount : 0;

      if (importTrigger?.ok !== true) {
        const errorCode =
          typeof importTrigger?.errorCode === 'string'
            ? importTrigger.errorCode
            : 'trigger_status_missing';
        const triggerStatus =
          errorCode === 'webhook_not_configured'
            ? 'n8n webhook yapılandırılmamış'
            : errorCode === 'webhook_http_error'
              ? 'n8n webhook HTTP hatası' +
                (typeof importTrigger?.status === 'number'
                  ? ' (' + importTrigger.status + ')'
                  : '')
              : errorCode === 'webhook_network_error'
                ? 'n8n webhook bağlantı hatası'
                : errorCode === 'trigger_skipped'
                  ? 'Import tetiklemesi atlandı'
                  : 'Tetikleme sonucu eksik';

        setState({
          status: 'warning',
          message: 'Fetch tamamlandı; importer tetiklenmesi doğrulanmadı.',
          detail:
            'Run ID: ' +
            runId +
            ' · Kuyruğa alınan kayıt: ' +
            queuedCount +
            ' · ' +
            triggerStatus +
            ' · Aynı refresh’i tekrarlamayın; bu run ID için importer çalışmasını doğrulayın.',
        });
        return;
      }

      setState({
        status: 'success',
        message: 'Katalog verisi kuyruğa alındı ve importer tetiklendi.',
        detail:
          'Run ID: ' +
          runId +
          ' · Kuyruğa alınan kayıt: ' +
          queuedCount +
          ' · Bu bildirim importer’ın tamamlandığı anlamına gelmez.',
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
  const isBlocked = state.status === 'warning';
  const isDisabled = isLoading || isBlocked;

  return (
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
        disabled={isDisabled}
        style={{
          width: 'fit-content',
          border: 'none',
          borderRadius: 999,
          padding: '10px 14px',
          background: isDisabled ? '#9ca3af' : '#111827',
          color: '#fff',
          fontWeight: 800,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {isLoading
          ? 'Sync başlatılıyor...'
          : isBlocked
            ? 'Importer durumu kontrol edilmeli'
            : 'ikas Kataloğunu Yenile'}
      </button>

      {state.message ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background:
              state.status === 'success'
                ? '#ecfdf5'
                : state.status === 'warning'
                  ? '#fffbeb'
                  : state.status === 'error'
                    ? '#fef2f2'
                    : '#f9fafb',
            border:
              state.status === 'success'
                ? '1px solid #a7f3d0'
                : state.status === 'warning'
                  ? '1px solid #fde68a'
                  : state.status === 'error'
                    ? '1px solid #fecaca'
                    : '1px solid #e5e7eb',
            color:
              state.status === 'success'
                ? '#065f46'
                : state.status === 'warning'
                  ? '#92400e'
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
  );
}
