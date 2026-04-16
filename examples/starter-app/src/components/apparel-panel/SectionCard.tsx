import type { ReactNode } from 'react';

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  subtitle,
  children,
}: SectionCardProps) {
  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: 20,
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            color: '#111827',
          }}
        >
          {title}
        </h2>

        {subtitle ? (
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: 14,
              color: '#6b7280',
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}
