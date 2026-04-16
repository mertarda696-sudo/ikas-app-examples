import type { ReactNode } from 'react';

type MetricTone = 'default' | 'success' | 'warning' | 'danger';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: MetricTone;
};

const toneMap: Record<MetricTone, { border: string; bg: string }> = {
  default: {
    border: '#e5e7eb',
    bg: '#ffffff',
  },
  success: {
    border: '#bbf7d0',
    bg: '#f0fdf4',
  },
  warning: {
    border: '#fde68a',
    bg: '#fffbeb',
  },
  danger: {
    border: '#fecaca',
    bg: '#fef2f2',
  },
};

export function MetricCard({
  label,
  value,
  helper,
  tone = 'default',
}: MetricCardProps) {
  const colors = toneMap[tone];

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#6b7280',
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: '#111827',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>

      {helper ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            color: '#6b7280',
          }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}
