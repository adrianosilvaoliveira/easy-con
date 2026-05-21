import { ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SettingsNavItemProps {
  label: string;
  description?: string;
  active?: boolean;
  onClick: () => void;
}

export function SettingsNavItem({ label, description, active, onClick }: SettingsNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left shadow-card transition',
        active
          ? 'border-primary-600 bg-primary-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80'
      )}
    >
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', active ? 'text-white' : '')}>{label}</p>
        {description && (
          <p
            className={cn(
              'mt-0.5 truncate text-xs',
              active ? 'text-primary-100' : 'text-slate-500 dark:text-slate-400'
            )}
          >
            {description}
          </p>
        )}
      </div>
      <ChevronRight
        className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-primary-600')}
      />
    </button>
  );
}
