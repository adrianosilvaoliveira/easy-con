import { FileText, Download, Filter, ExternalLink, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ReportCardProps {
  label: string;
  accent?: 'primary' | 'amber';
  showFilter?: boolean;
  onOpen: () => void;
  onFilter?: () => void;
  onDownloadPdf: () => void;
  onOpenPdf: () => void;
}

export function ReportCard({
  label,
  accent = 'primary',
  showFilter,
  onOpen,
  onFilter,
  onDownloadPdf,
  onOpenPdf,
}: ReportCardProps) {
  const iconBg =
    accent === 'amber'
      ? 'bg-amber-50 dark:bg-amber-950/50'
      : 'bg-primary-50 dark:bg-primary-950/50';
  const iconColor =
    accent === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-primary-600 dark:text-primary-400';

  return (
    <div
      className={cn(
        'card group flex items-stretch overflow-hidden p-0 transition',
        'hover:border-primary-200 hover:shadow-elevated dark:hover:border-primary-700'
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition group-hover:bg-slate-50/50 dark:group-hover:bg-slate-700/40"
      >
        <div className={cn('shrink-0 rounded-lg p-2', iconBg)}>
          <FileText className={cn('h-5 w-5', iconColor)} />
        </div>
        <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">{label}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-primary-500 dark:text-slate-500" />
      </button>

      <div
        className="flex shrink-0 items-center border-l border-surface-border bg-slate-50/50 dark:bg-slate-900/50"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {showFilter && onFilter && (
          <button
            type="button"
            onClick={onFilter}
            className="rounded-none p-3 text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            title="Filtros"
          >
            <Filter className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenPdf}
          className="rounded-none border-l border-surface-border p-3 text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Abrir PDF em nova aba"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          className="rounded-none border-l border-surface-border p-3 text-primary-600 hover:bg-white hover:text-primary-700 dark:text-primary-400 dark:hover:bg-slate-700 dark:hover:text-primary-300"
          title="Baixar PDF"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
