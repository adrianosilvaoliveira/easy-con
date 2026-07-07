import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useDebounce } from '@/hooks/useDebounce';
import api from '@/services/api';
import { SupplierFormModal, type CreatedSupplier } from './SupplierFormModal';

export interface SupplierOption {
  id: string;
  name: string;
  cnpj?: string | null;
  email?: string | null;
}

interface SupplierSearchSelectProps {
  value: string;
  onChange: (supplierId: string, supplier?: SupplierOption) => void;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  allowCreate?: boolean;
  /** Permite limpar seleção (ex.: fornecedor opcional na entrada) */
  allowClear?: boolean;
  placeholder?: string;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function fuzzyScore(query: string, supplier: SupplierOption): number {
  const q = normalize(query.trim());
  if (!q) return 0;
  const name = normalize(supplier.name);
  const cnpj = supplier.cnpj ? normalize(supplier.cnpj) : '';
  const email = supplier.email ? normalize(supplier.email) : '';

  if (name === q) return 100;
  if (name.startsWith(q) || cnpj.startsWith(q)) return 80;
  if (name.includes(q) || cnpj.includes(q) || email.includes(q)) return 60;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.every((p) => name.includes(p))) return 40;
  return 0;
}

export function SupplierSearchSelect({
  value,
  onChange,
  label = 'Fornecedor',
  error,
  required,
  disabled,
  allowCreate = true,
  allowClear = true,
  placeholder = 'Digite nome ou CNPJ do fornecedor...',
}: SupplierSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<SupplierOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data: suppliers = [], isFetching } = useQuery({
    queryKey: ['suppliers-search', debouncedQuery],
    queryFn: () =>
      api
        .get('/suppliers', { params: { search: debouncedQuery.trim() || undefined, limit: 30 } })
        .then((r) => r.data.data as SupplierOption[]),
    enabled: open || !!debouncedQuery || !!value,
    staleTime: 60_000,
  });

  const ranked = useMemo(() => {
    if (!query.trim()) return suppliers.slice(0, 15);
    return [...suppliers]
      .map((s) => ({ s, score: fuzzyScore(query, s) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s)
      .slice(0, 15);
  }, [suppliers, query]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      if (!open) setQuery('');
      return;
    }
    if (selected?.id === value) return;
    const found = suppliers.find((s) => s.id === value);
    if (found) {
      setSelected(found);
      setQuery(found.name);
    }
  }, [value, suppliers, selected?.id, open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (supplier: SupplierOption) => {
    setSelected(supplier);
    setQuery(supplier.name);
    onChange(supplier.id, supplier);
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    onChange('');
    setOpen(true);
  };

  const handleCreated = (supplier: CreatedSupplier) => {
    handleSelect({
      id: supplier.id,
      name: supplier.name,
      cnpj: supplier.cnpj,
    });
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              disabled={disabled}
              placeholder={placeholder}
              className={cn(
                'input-field w-full pl-9 pr-9',
                error && 'border-red-400 focus:ring-red-200'
              )}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                if (selected) {
                  setSelected(null);
                  onChange('');
                }
              }}
            />
            {isFetching && open && !selected && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
            {selected && allowClear && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Limpar fornecedor"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {allowCreate && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setModalOpen(true)}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-600 transition hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-400 dark:hover:bg-primary-900/50"
              title="Cadastrar novo fornecedor"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

        {open && !disabled && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-surface-border bg-white py-1 shadow-elevated dark:border-slate-600 dark:bg-slate-800">
            {allowClear && !query.trim() && (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
                  onClick={handleClear}
                >
                  Nenhum fornecedor
                </button>
              </li>
            )}
            {ranked.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                {query.trim() ? (
                  <>
                    Nenhum fornecedor encontrado
                    {allowCreate && (
                      <button
                        type="button"
                        className="mt-2 block w-full text-primary-600 hover:underline dark:text-primary-400"
                        onClick={() => {
                          setOpen(false);
                          setModalOpen(true);
                        }}
                      >
                        + Cadastrar &quot;{query.trim()}&quot;
                      </button>
                    )}
                  </>
                ) : (
                  'Digite para buscar ou selecione Nenhum'
                )}
              </li>
            ) : (
              ranked.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-slate-700',
                      value === s.id && 'bg-primary-50 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                    )}
                    onClick={() => handleSelect(s)}
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                    {(s.cnpj || s.email) && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {[s.cnpj, s.email].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <SupplierFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreated}
        initialName={query.trim()}
      />
    </>
  );
}
