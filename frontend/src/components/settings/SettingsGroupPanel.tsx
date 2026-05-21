import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SettingsGroupPanelProps {
  groupTitle: string;
  sectionTitle: string;
  sectionHint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** Cabeçalho #1E293B alinhado ao menu superior; corpo no padrão .card */
export function SettingsGroupPanel({
  groupTitle,
  sectionTitle,
  sectionHint,
  children,
  defaultOpen = true,
}: SettingsGroupPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-[#1E293B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        aria-expanded={open}
      >
        <span>{groupTitle}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="p-4 sm:p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{sectionTitle}</h3>
          {sectionHint && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{sectionHint}</p>
          )}
          <div className="my-4 border-b border-dashed border-surface-border dark:border-slate-600" />
          {children}
        </div>
      )}
    </div>
  );
}
