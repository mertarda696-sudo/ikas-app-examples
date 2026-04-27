import type { ReactNode } from 'react';
import { InboxMediaCopyEnhancer } from './InboxMediaCopyEnhancer';

export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <InboxMediaCopyEnhancer />
    </>
  );
}
