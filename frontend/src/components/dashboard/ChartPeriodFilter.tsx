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
      className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-slate-100/80 p-0.5"
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
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
