import React from 'react';
import { AppShell } from '@/components/apparel-panel/AppShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
