import OrderSyncButton from '@/components/apparel-panel/OrderSyncButton';
import type { ReactNode } from 'react';

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '24px 24px 0',
        }}
      >
        <OrderSyncButton />
      </div>
      {children}
    </>
  );
}
