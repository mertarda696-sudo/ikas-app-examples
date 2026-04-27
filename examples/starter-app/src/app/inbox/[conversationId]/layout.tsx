import type { ReactNode } from 'react';
import { MediaMessageEnhancer } from './MediaMessageEnhancer';

export default function ConversationDetailLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MediaMessageEnhancer />
    </>
  );
}
