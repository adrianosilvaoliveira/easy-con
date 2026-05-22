import { cn } from '@/utils/cn';

export type ExpirationStatusType = 'VALID' | 'WARNING' | 'CRITICAL' | 'EXPIRED';

const config: Record<
  ExpirationStatusType,
  { label: string; className: string }
> = {
  VALID: {
    label: 'Válido',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  WARNING: {
    label: 'Atenção',
    className:
      'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300',
  },
  CRITICAL: {
    label: 'Crítico',
    className:
      'bg-orange-50 text-orange-800 ring-orange-600/20 dark:bg-orange-950/50 dark:text-orange-300',
  },
  EXPIRED: {
    label: 'Vencido',
    className: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-300',
  },
};

export function ExpirationBadge({
  status,
  days,
  className,
}: {
  status: ExpirationStatusType;
  days?: number;
  className?: string;
}) {
  const c = config[status] || config.VALID;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        c.className,
        className
      )}
    >
      {c.label}
      {days !== undefined && days >= 0 && (
        <span className="opacity-80">· {days}d</span>
      )}
    </span>
  );
}
