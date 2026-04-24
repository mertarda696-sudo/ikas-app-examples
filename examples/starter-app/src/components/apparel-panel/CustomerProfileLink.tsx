import Link from 'next/link';

type CustomerProfileLinkProps = {
  customerWaId?: string | null;
  label?: string;
  compact?: boolean;
};

export function CustomerProfileLink({
  customerWaId,
  label = 'Müşteri Profiline Git →',
  compact = false,
}: CustomerProfileLinkProps) {
  const normalizedCustomerWaId = String(customerWaId || '').trim();

  if (!normalizedCustomerWaId) {
    return null;
  }

  return (
    <Link
      href={`/customers/${encodeURIComponent(normalizedCustomerWaId)}`}
      style={{
        color: '#111827',
        fontWeight: 800,
        textDecoration: 'none',
        fontSize: compact ? 13 : 14,
        display: 'inline-block',
        marginTop: compact ? 4 : 6,
      }}
    >
      {label}
    </Link>
  );
}
