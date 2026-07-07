interface IncludeInactiveFilterProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function IncludeInactiveFilter({
  checked,
  onChange,
  className = '',
}: IncludeInactiveFilterProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
      />
      Mostrar inativos
    </label>
  );
}
