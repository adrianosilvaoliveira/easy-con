import { cn } from '@/utils/cn';

export type ChartPeriod = 'day' | 'week' | 'month' | 'semester' | 'year';

const OPTIONS: { value: ChartPeriod; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'semester', label: 'Semestre' },
  { value: 'year', label: 'Ano' },
];

interface ChartPeriodFilterProps {
  value: ChartPeriod;
  onChange: (period: ChartPeriod) => void;
}

export function ChartPeriodFilter({ value, onChange }: ChartPeriodFilterProps) {
  return (
    <div
      className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-300 bg-slate-200 p-0.5 dark:border-slate-600 dark:bg-slate-700"
      role="group"
      aria-label="Período do gráfico"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition',
            value === opt.value
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-300 dark:bg-slate-900 dark:text-white dark:ring-slate-500'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-600'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
