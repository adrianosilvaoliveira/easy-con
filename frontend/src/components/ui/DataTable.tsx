import { ReactNode } from 'react';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  /** Oculta coluna em telas menores que o breakpoint */
  hideBelow?: 'sm' | 'md' | 'lg';
}

const hideClasses = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  emptyIcon,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) return <div className="table-container"><TableSkeleton /></div>;

  if (!data.length && emptyIcon) {
    return (
      <div className="table-container">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="table-container w-full max-w-full">
      <table className="w-full min-w-0 text-sm sm:min-w-[520px]">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700/80">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-700 sm:px-4 sm:py-3 sm:text-sm dark:text-slate-200',
                  col.hideBelow && hideClasses[col.hideBelow],
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={cn(
                'border-b border-surface-border transition',
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30',
                onRowClick && 'cursor-pointer hover:bg-primary-50/30'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-3 py-2.5 text-slate-700 sm:px-4 sm:py-3',
                    col.hideBelow && hideClasses[col.hideBelow],
                    col.className
                  )}
                >
                  {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
