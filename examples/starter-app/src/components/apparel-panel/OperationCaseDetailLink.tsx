import Link from 'next/link';

export function OperationCaseDetailLink({
  caseId,
  caseNo,
  compact = false,
}: {
  caseId: string | null | undefined;
  caseNo?: string | null;
  compact?: boolean;
}) {
  const target = String(caseNo || caseId || '').trim();

  if (!target) return null;

  return (
    <Link
      href={`/operations/${target}`}
      style={{
        textDecoration: 'none',
        color: '#2563eb',
        fontSize: compact ? 12 : 13,
        fontWeight: 800,
      }}
    >
      Vaka Detayına Git →
    </Link>
  );
}
