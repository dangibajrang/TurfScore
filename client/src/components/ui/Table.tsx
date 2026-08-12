import { cn } from '@/lib/cn';

type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

type TableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  className?: string;
};

export function Table<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No rows yet',
  className,
}: TableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-card border border-border-subtle', className)}>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-elevated text-text-muted">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn('px-3 py-2.5 font-semibold', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-t border-border-subtle">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-3 py-2.5 text-text', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
