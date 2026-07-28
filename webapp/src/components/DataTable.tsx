import type { ReactNode } from 'react';
import { Skeleton, EmptyState } from './States';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  mono?: boolean;
}

// Bảng dữ liệu: sticky header, hover, phân trang, loading skeleton, empty state.
export function DataTable<T>({
  columns,
  rows,
  loading,
  emptyTitle = 'Không có dữ liệu',
  emptyHint,
  onRowClick,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
}) {
  if (loading) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <Skeleton rows={7} />
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return <EmptyState icon="box" title={emptyTitle} hint={emptyHint} />;
  }
  return (
    <div className="panel scrl" style={{ overflow: 'auto', maxHeight: '70vh' }}>
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align ?? 'left', width: c.width }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={c.mono ? 'num' : undefined}
                  style={{ textAlign: c.align ?? 'left' }}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
