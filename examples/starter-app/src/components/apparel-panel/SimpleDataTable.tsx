import type { ReactNode } from 'react';

export type TableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
};

type SimpleDataTableProps<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  emptyText?: string;
};

export function SimpleDataTable<T>({
  columns,
  rows,
  emptyText = 'Veri bulunamadı.',
}: SimpleDataTableProps<T>) {
  if (!rows.length) {
    return (
      <div
        style={{
          border: '1px dashed #d1d5db',
          borderRadius: 12,
          padding: 16,
          color: '#6b7280',
          background: '#fafafa',
        }}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid #e5e7eb',
        borderRadius: 14,
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: 760,
          background: '#ffffff',
        }}
      >
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: column.align || 'left',
                  padding: '12px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#374151',
                  borderBottom: '1px solid #e5e7eb',
                  width: column.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    textAlign: column.align || 'left',
                    padding: '12px 14px',
                    fontSize: 14,
                    color: '#111827',
                    borderBottom:
                      rowIndex === rows.length - 1
                        ? 'none'
                        : '1px solid #f3f4f6',
                    verticalAlign: 'top',
                  }}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
