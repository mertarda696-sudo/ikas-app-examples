'use client';

import { useEffect, useState } from 'react';

type DiagnosticBody = Record<string, unknown> & {
  ok?: boolean;
  mutationPerformed?: boolean;
  stage?: string;
  error?: string | null;
};

function isPreflightPass(body: DiagnosticBody) {
  return (
    body.ok === true &&
    body.mutationPerformed === false &&
    body.stage === 'persistence_lock_preflight_pass'
  );
}

async function readPersistencePreflight(): Promise<{
  httpStatus: number;
  body: DiagnosticBody;
}> {
  const response = await fetch('/api/internal/catalog-fetch-diagnostic', {
    method: 'GET',
    cache: 'no-store',
  });

  const rawText = await response.text();
  let body: DiagnosticBody;

  try {
    body = rawText ? (JSON.parse(rawText) as DiagnosticBody) : {};
  } catch {
    body = {
      ok: false,
      mutationPerformed: false,
      error: rawText || `HTTP ${response.status} ${response.statusText}`,
    };
  }

  return {
    httpStatus: response.status,
    body,
  };
}

export function CatalogFetchControlClient() {
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [preflight, setPreflight] = useState<DiagnosticBody | null>(null);

  const preflightReady = Boolean(preflight && isPreflightPass(preflight));

  useEffect(() => {
    let active = true;

    const run = async () => {
      setPreflightLoading(true);

      try {
        const diagnostic = await readPersistencePreflight();

        if (!active) return;

        setPreflight({
          httpStatus: diagnostic.httpStatus,
          ...diagnostic.body,
        });
      } catch (error) {
        if (!active) return;

        setPreflight({
          ok: false,
          mutationPerformed: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown persistence preflight error',
        });
      } finally {
        if (active) setPreflightLoading(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  const runControlledFetch = async () => {
    if (loading || attempted || !preflightReady) return;

    setLoading(true);
    setResult(null);

    try {
      const diagnostic = await readPersistencePreflight();
      const currentPreflight = {
        httpStatus: diagnostic.httpStatus,
        ...diagnostic.body,
      };

      setPreflight(currentPreflight);

      if (!isPreflightPass(diagnostic.body)) {
        setResult({
          ok: false,
          attempted: false,
          error: 'CONTROL_PREFLIGHT_NOT_READY',
          message:
            'READ-ONLY persistence preflight no longer passes. Controlled mutation was not started.',
          preflight: currentPreflight,
        });
        return;
      }

      setAttempted(true);

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
        attempted,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown controlled fetch error',
      });
    } finally {
      setLoading(false);
    }
  };

  const buttonDisabled =
    preflightLoading || !preflightReady || loading || attempted;

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
            border: preflightReady
              ? '1px solid #bbf7d0'
              : '1px solid #fde68a',
            background: preflightReady ? '#f0fdf4' : '#fffbeb',
            borderRadius: 12,
            padding: 14,
            color: preflightReady ? '#166534' : '#92400e',
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 18,
            fontWeight: 700,
          }}
        >
          {preflightLoading
            ? 'READ-ONLY persistence preflight çalışıyor...'
            : preflightReady
              ? 'READ-ONLY persistence preflight PASS — controlled fetch hazır.'
              : 'READ-ONLY persistence preflight PASS değil — mutation butonu kilitli.'}
        </div>

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
          Test otomatik başlamaz. Buton ancak READ-ONLY preflight PASS ise açılır.
          Butona yalnız bir kez basın; POST öncesinde preflight server çağrısı tekrar
          doğrulanır.
        </div>

        <button
          type="button"
          onClick={runControlledFetch}
          disabled={buttonDisabled}
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            border: 0,
            background: buttonDisabled ? '#d1d5db' : '#111827',
            color: buttonDisabled ? '#6b7280' : '#ffffff',
            fontWeight: 800,
            cursor: buttonDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {preflightLoading
            ? 'Preflight bekleniyor...'
            : !preflightReady
              ? 'Preflight PASS olmadan çalıştırılamaz'
              : loading
                ? 'Controlled fetch çalışıyor...'
                : attempted
                  ? 'Controlled fetch denendi — tekrar çalıştırılamaz'
                  : 'ONE Controlled Live Fetch’i Çalıştır'}
        </button>

        {preflight && !preflightReady ? (
          <pre
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 12,
              background: '#7c2d12',
              color: '#fff7ed',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {JSON.stringify(preflight, null, 2)}
          </pre>
        ) : null}

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
