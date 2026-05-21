interface ActiveToggleFieldProps {
  active: boolean;
  onChange: (active: boolean) => void;
  disabled?: boolean;
}

export function ActiveToggleField({ active, onChange, disabled }: ActiveToggleFieldProps) {
  return (
    <div className="rounded-lg border border-surface-border bg-slate-50 px-4 py-3 sm:col-span-2">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">Status do cadastro</p>
          <p className="text-xs text-slate-500">
            Inativos não aparecem em buscas e seleções operacionais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
            {active ? 'Ativo' : 'Inativo'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(!active)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              active ? 'bg-emerald-500' : 'bg-slate-300'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                active ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </label>
    </div>
  );
}
