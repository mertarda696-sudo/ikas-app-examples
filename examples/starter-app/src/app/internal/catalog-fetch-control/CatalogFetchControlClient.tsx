'use client';

import { useState } from 'react';

export function CatalogFetchControlClient() {
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const runControlledFetch = async () => {
    if (loading || attempted) return;

    setLoading(true);
    setAttempted(true);
    setResult(null);

    try {
      const response = await fetch('/api/internal/catalog-fetch-control', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'x-catalog-control-intent': 'controlled-live-fetch-v1',
        },
        body: JSON.stringify({
          intent: 'controlled-live-fetch-v1',
        }),
      });

      const rawText = await response.text();
      let body: Record<string, unknown>;

      try {
        body = rawText
          ? (JSON.parse(rawText) as Record<string, unknown>)
          : {};
      } catch {
        body = {
          ok: false,
          error: rawText || `HTTP ${response.status} ${response.statusText}`,
        };
      }

      setResult({
        httpStatus: response.status,
        ...body,
      });
    } catch (error) {
      setResult({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown controlled fetch error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: 24,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 18,
          background: '#ffffff',
          padding: 22,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: '#92400e',
            marginBottom: 8,
          }}
        >
          Preview-only controlled mutation
        </div>

        <h1
          style={{
            margin: '0 0 12px',
            fontSize: 28,
            color: '#111827',
          }}
        >
          ONE Controlled MIRELLE Live Fetch
        </h1>

        <p
          style={{
            color: '#4b5563',
            lineHeight: 1.7,
            marginBottom: 18,
          }}
        >
          Bu buton gerçek IKAS kataloğunu bir kez çeker, terminal fetch run + typed
          fetch contract + raw queue oluşturur ve mevcut catalog import webhook&apos;unu
          tetikler. İlk production typed contract görüldükten sonra server ikinci
          controlled initialization isteğini bloklar.
        </p>

        <div
          style={{
            border: '1px solid #fde68a',
            background: '#fffbeb',
            borderRadius: 12,
            padding: 14,
            color: '#92400e',
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          Bu test otomatik başlamaz. Butona yalnız bir kez basın. Sonrasında sayfayı
          yenileyip tekrar denemeyin; evidence kontrolü ayrı READ-ONLY endpointten
          yapılacaktır.
        </div>

        <button
          type="button"
          onClick={runControlledFetch}
          disabled={loading || attempted}
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            border: 0,
            background: loading || attempted ? '#d1d5db' : '#111827',
            color: loading || attempted ? '#6b7280' : '#ffffff',
            fontWeight: 800,
            cursor: loading || attempted ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? 'Controlled fetch çalışıyor...'
            : attempted
              ? 'Controlled fetch denendi — tekrar çalıştırılamaz'
              : 'ONE Controlled Live Fetch’i Çalıştır'}
        </button>

        {result ? (
          <pre
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 12,
              background: '#111827',
              color: '#f9fafb',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </div>
    </main>
  );
}
