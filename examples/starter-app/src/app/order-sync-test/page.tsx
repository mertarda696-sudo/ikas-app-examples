'use client';

import { AppShell } from '@/components/apparel-panel/AppShell';
import OrderSyncButton from '@/components/apparel-panel/OrderSyncButton';

export default function OrderSyncTestPage() {
  return (
    <AppShell>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            ikas Sipariş Sync Test
          </h1>
          <p style={{ color: '#4b5563', margin: 0, lineHeight: 1.7 }}>
            Bu geçici test ekranı, ikas siparişlerini Supabase commerce_orders ve commerce_order_items tablolarına çekmek için kullanılır. Test geçtikten sonra buton Siparişler sayfasına taşınacak ve bu geçici ekran kaldırılacak.
          </p>
        </div>

        <OrderSyncButton />
      </main>
    </AppShell>
  );
}
