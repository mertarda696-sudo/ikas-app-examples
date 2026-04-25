'use client';

import Link from 'next/link';
import { AppShell } from '@/components/apparel-panel/AppShell';
import { OperatorActionSummaryBox } from '@/components/apparel-panel/OperatorActionSummaryBox';

export default function OperatorActionsPage() {
  return (
    <AppShell>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 8 }}>
                Panel Operasyon Merkezi
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: '#111827', margin: '0 0 8px' }}>
                Operatör Aksiyon Merkezi
              </h1>
              <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7, maxWidth: 760 }}>
                Yanıt bekleyen konuşmaları, açık operasyon vakalarını, CRM risklerini ve öncelikli müşteri takiplerini tek ekranda izleyin.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/dashboard" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 800 }}>
                Dashboard →
              </Link>
              <Link href="/inbox" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#111827', color: '#ffffff', fontWeight: 800 }}>
                Mesajlar →
              </Link>
              <Link href="/operations" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontWeight: 800 }}>
                Operasyonlar →
              </Link>
            </div>
          </div>
        </div>

        <OperatorActionSummaryBox />
      </main>
    </AppShell>
  );
}
