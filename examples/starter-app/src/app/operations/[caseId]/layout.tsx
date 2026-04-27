import type { ReactNode } from 'react';
import { EvidenceStateEnhancer } from './EvidenceStateEnhancer';

export default function OperationCaseDetailLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <EvidenceStateEnhancer />
    </>
  );
}
