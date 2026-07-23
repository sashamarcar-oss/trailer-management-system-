"use client";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyLabel?: string;
  getRowKey?: (row: T, index: number) => string;
}

export function Table<T extends Record<string, any>>({
  columns, rows, loading, emptyLabel = "No records yet", getRowKey,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm" style={{ minWidth: 640 }}>
        <thead>
          <tr className="bg-teal-light">
            {columns.map((c) => (
              <th key={String(c.key)} className="text-left font-medium px-4 py-3 whitespace-nowrap text-teal">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-t border-border bg-card">
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-4 py-3">
                    <div className="h-4 rounded bg-muted animate-pulse" style={{ width: "70%" }} />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground bg-card">
                {emptyLabel}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row, i) => (
              <tr key={getRowKey ? getRowKey(row, i) : i} className="border-t border-border bg-card">
                {columns.map((c) => (
                  <td key={String(c.key)} className="px-4 py-3 whitespace-nowrap">
                    {c.render ? c.render(row) : row[c.key as string]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
