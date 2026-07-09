import { ReactNode, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  /** Ativa virtualização de linhas (renderiza só o visível) para listas grandes. */
  virtualized?: boolean;
  /** Altura máxima da área rolável quando virtualizado. */
  maxHeight?: number;
  /** Altura estimada de cada linha (px) para o cálculo de virtualização. */
  estimateRowHeight?: number;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  emptyIcon,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription,
  onRowClick,
  virtualized,
  maxHeight = 560,
  estimateRowHeight = 44,
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
  });

  if (loading) return <div className="table-container"><TableSkeleton /></div>;

  if (!data.length && emptyIcon) {
    return (
      <div className="table-container">
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  const headerCells = columns.map((col) => (
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
  ));

  const renderRow = (item: T, i: number) => (
    <tr
      key={item.id}
      onClick={() => onRowClick?.(item)}
      className={cn(
        'border-b border-surface-border transition',
        i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/30 dark:bg-slate-800/50',
        onRowClick && 'cursor-pointer hover:bg-primary-50/30 dark:hover:bg-primary-900/30'
      )}
    >
      {columns.map((col) => (
        <td
          key={col.key}
          className={cn(
            'whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200 sm:px-4 sm:py-3',
            col.hideBelow && hideClasses[col.hideBelow],
            col.className
          )}
        >
          {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as ReactNode}
        </td>
      ))}
    </tr>
  );

  if (virtualized) {
    const virtualItems = rowVirtualizer.getVirtualItems();
    const paddingTop = virtualItems.length ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

    return (
      <div
        ref={scrollRef}
        className="table-container w-full max-w-full overflow-auto"
        style={{ maxHeight }}
      >
        <table className="w-full min-w-0 text-sm sm:min-w-[520px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700/80">
              {headerCells}
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && <tr style={{ height: paddingTop }} aria-hidden />}
            {virtualItems.map((vi) => renderRow(data[vi.index], vi.index))}
            {paddingBottom > 0 && <tr style={{ height: paddingBottom }} aria-hidden />}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-container w-full max-w-full">
      <table className="w-full min-w-0 text-sm sm:min-w-[520px]">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700/80">
            {headerCells}
          </tr>
        </thead>
        <tbody>{data.map((item, i) => renderRow(item, i))}</tbody>
      </table>
    </div>
  );
}
