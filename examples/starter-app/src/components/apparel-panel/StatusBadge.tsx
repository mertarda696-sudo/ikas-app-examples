type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

const styles: Record<
  StatusTone,
  { bg: string; color: string; border: string }
> = {
  success: {
    bg: '#ecfdf5',
    color: '#065f46',
    border: '#a7f3d0',
  },
  warning: {
    bg: '#fffbeb',
    color: '#92400e',
    border: '#fde68a',
  },
  danger: {
    bg: '#fef2f2',
    color: '#991b1b',
    border: '#fecaca',
  },
  neutral: {
    bg: '#f9fafb',
    color: '#374151',
    border: '#e5e7eb',
  },
};

export function StatusBadge({
  label,
  tone = 'neutral',
}: StatusBadgeProps) {
  const style = styles[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {label}
    </span>
  );
}
