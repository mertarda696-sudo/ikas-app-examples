'use client';

import { useState } from 'react';

import { TokenHelpers } from '@/helpers/token-helpers';

type AuditResult = {
  ok?: boolean;
  fetchedAt?: string;
  auditVersion?: string;
  mutationPerformed?: boolean;
  credentialMutationPerformed?: boolean;
  c2aReady?: boolean;
  evidence?: Record<string, boolean>;
  listProduct?: unknown;
  paginationInput?: unknown;
  returnType?: unknown;
  error?: string;
  message?: string;
  previewIdentitySource?: string;
  tokenRefreshRequired?: boolean;
  [key: string]: unknown;
};

export default function G3CatalogSchemaAuditPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const runAudit = async () => {
    try {
      setLoading(true);
      setResult(null);
      setHttpStatus(null);
      setCopyState('idle');

      const iframeToken = await TokenHelpers.getTokenForIframeApp();
      const endpoint = iframeToken
        ? '/api/ikas/catalog-schema-audit'
        : '/api/internal/g3-c2-catalog-schema-audit';

      const response = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: iframeToken
          ? {
              Authorization: 'JWT ' + iframeToken,
            }
          : undefined,
      });

      const rawText = await response.text();
      let raw: AuditResult;

      try {
        raw = rawText
          ? (JSON.parse(rawText) as AuditResult)
          : {};
      } catch {
        raw = {
          ok: false,
          mutationPerformed: false,
          credentialMutationPerformed: false,
          error:
            rawText ||
            `HTTP ${response.status} ${response.statusText}`,
        };
      }

      setHttpStatus(response.status);
      setResult(raw);
    } catch (error) {
      setHttpStatus(500);
      setResult({
        ok: false,
        mutationPerformed: false,
        credentialMutationPerformed: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown audit UI error',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyJson = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(result, null, 2),
      );
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const identityBlocked =
    result?.error === 'PREVIEW_IDENTITY_NOT_UNIQUE';

  const tokenRefreshBlocked =
    result?.error ===
    'IKAS_TOKEN_REFRESH_REQUIRED_FOR_READ_ONLY_AUDIT';

  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: 24,
        minHeight: '100vh',
        background: '#f9fafb',
      }}
    >
      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 18,
          background: '#ffffff',
          padding: 20,
          display: 'grid',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#1d4ed8',
              textTransform: 'uppercase',
              letterSpacing: 0.45,
              marginBottom: 8,
            }}
          >
            G3-C2A · READ-ONLY
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.2,
              color: '#111827',
            }}
          >
            IKAS Catalog Pagination Schema Audit
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: '#4b5563',
              lineHeight: 1.7,
            }}
          >
            Bu araç yalnız IKAS GraphQL şemasını okur. Ürün yazmaz, katalog sync
            başlatmaz, Supabase/n8n mutation yapmaz ve audit sırasında OAuth token
            refresh/persist işlemi de yapmaz.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={runAudit}
            disabled={loading}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '11px 16px',
              background: loading ? '#9ca3af' : '#111827',
              color: '#ffffff',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading
              ? 'Schema audit çalışıyor...'
              : 'READ-ONLY Schema Audit’i Çalıştır'}
          </button>

          {result ? (
            <button
              type="button"
              onClick={copyJson}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: 12,
                padding: '11px 16px',
                background: '#ffffff',
                color: '#111827',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {copyState === 'copied'
                ? 'JSON Kopyalandı'
                : copyState === 'failed'
                  ? 'Kopyalama Başarısız'
                  : 'JSON’u Kopyala'}
            </button>
          ) : null}
        </div>

        {identityBlocked ? (
          <div
            style={{
              border: '1px solid #fde68a',
              borderRadius: 14,
              background: '#fffbeb',
              padding: 14,
              color: '#92400e',
              lineHeight: 1.7,
            }}
          >
            Preview ortamında tek ve aktif commerce OAuth identity belirlenemedi.
            Audit fail-closed durdu; herhangi bir mutation yapılmadı.
          </div>
        ) : null}

        {tokenRefreshBlocked ? (
          <div
            style={{
              border: '1px solid #fde68a',
              borderRadius: 14,
              background: '#fffbeb',
              padding: 14,
              color: '#92400e',
              lineHeight: 1.7,
            }}
          >
            Mevcut IKAS token refresh penceresine girmiş. READ-ONLY audit tokenı
            yenilemedi ve fail-closed durdu.
          </div>
        ) : null}

        {result ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  HTTP
                </div>
                <div style={{ fontWeight: 800 }}>{httpStatus ?? '-'}</div>
              </div>

              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  Audit Durumu
                </div>
                <div style={{ fontWeight: 800 }}>
                  {result.ok ? 'OK' : 'FAIL'}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  C2A Ready
                </div>
                <div style={{ fontWeight: 800 }}>
                  {String(result.c2aReady ?? false)}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  Mutation
                </div>
                <div style={{ fontWeight: 800 }}>
                  {String(result.mutationPerformed ?? false)}
                </div>
              </div>
            </div>

            <pre
              style={{
                margin: 0,
                border: '1px solid #d1d5db',
                borderRadius: 14,
                padding: 14,
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
          </>
        ) : null}
      </section>
    </main>
  );
}
