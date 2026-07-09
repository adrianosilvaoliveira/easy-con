import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

interface PaginationProps {
  meta?: PaginationMeta;
  page: number;
  onPageChange: (updater: (prev: number) => number) => void;
  loading?: boolean;
}

/** Controles de paginação server-side (Anterior / Próxima) reutilizáveis. */
export function Pagination({ meta, page, onPageChange, loading }: PaginationProps) {
  const totalPages = meta?.totalPages ?? 1;
  const hasPrev = meta?.hasPrev ?? false;
  const hasNext = meta?.hasNext ?? false;

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrev || loading}
          onClick={() => onPageChange((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext || loading}
          onClick={() => onPageChange((p) => p + 1)}
        >
          Próxima <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
