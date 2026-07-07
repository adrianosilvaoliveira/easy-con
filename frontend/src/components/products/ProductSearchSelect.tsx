import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatProductName } from '@/utils/format';
import { useDebounce } from '@/hooks/useDebounce';
import api from '@/services/api';
import { ProductFormModal, type CreatedProduct } from './ProductFormModal';

export interface ProductOption {
  id: string;
  name: string;
  internalCode: string;
  barcode?: string | null;
}

interface ProductSearchSelectProps {
  value: string;
  onChange: (productId: string, product?: ProductOption) => void;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  allowCreate?: boolean;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function fuzzyScore(query: string, product: ProductOption): number {
  const q = normalize(query.trim());
  if (!q) return 0;
  const name = normalize(product.name);
  const code = normalize(product.internalCode);
  const barcode = product.barcode ? normalize(product.barcode) : '';

  if (name === q || code === q) return 100;
  if (name.startsWith(q) || code.startsWith(q)) return 80;
  if (name.includes(q) || code.includes(q) || barcode.includes(q)) return 60;
  const qParts = q.split(/\s+/).filter(Boolean);
  if (qParts.every((p) => name.includes(p) || code.includes(p))) return 40;
  return 0;
}

export function ProductSearchSelect({
  value,
  onChange,
  label = 'Produto',
  error,
  required,
  disabled,
  allowCreate = true,
}: ProductSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data: products = [], isFetching } = useQuery({
    queryKey: ['products-search', debouncedQuery],
    queryFn: () =>
      api
        .get('/products', { params: { search: debouncedQuery.trim() || undefined, limit: 40 } })
        .then((r) => r.data.data as ProductOption[]),
    enabled: open || !!debouncedQuery,
    staleTime: 60_000,
  });

  const ranked = useMemo(() => {
    if (!query.trim()) return products.slice(0, 15);
    return [...products]
      .map((p) => ({ p, score: fuzzyScore(query, p) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p)
      .slice(0, 15);
  }, [products, query]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    const found = products.find((p) => p.id === value);
    if (found) {
      setSelected(found);
      setQuery(`${found.internalCode} — ${found.name}`);
    }
  }, [value, products, selected?.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (product: ProductOption) => {
    setSelected(product);
    setQuery(`${product.internalCode} — ${formatProductName(product.name)}`);
    onChange(product.id, product);
    setOpen(false);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    onChange('');
    setOpen(true);
  };

  const handleCreated = (product: CreatedProduct) => {
    const option: ProductOption = {
      id: product.id,
      name: product.name,
      internalCode: product.internalCode,
    };
    handleSelect(option);
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
              placeholder="Digite nome, código ou barras..."
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
            {isFetching && open && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
            {selected && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Limpar produto"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {allowCreate && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setProductModalOpen(true)}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-600 transition hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-400 dark:hover:bg-primary-900/50"
              title="Cadastrar novo produto"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

        {open && !disabled && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-surface-border bg-white py-1 shadow-elevated dark:border-slate-600 dark:bg-slate-800">
            {ranked.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                {query.trim() ? (
                  <>
                    Nenhum produto encontrado
                    {allowCreate && (
                      <button
                        type="button"
                        className="mt-2 block w-full text-primary-600 hover:underline dark:text-primary-400"
                        onClick={() => {
                          setOpen(false);
                          setProductModalOpen(true);
                        }}
                      >
                        + Cadastrar novo produto
                      </button>
                    )}
                  </>
                ) : (
                  'Digite para buscar produtos'
                )}
              </li>
            ) : (
              ranked.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-slate-700',
                      value === p.id && 'bg-primary-50 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                    )}
                    onClick={() => handleSelect(p)}
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">{formatProductName(p.name)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {p.internalCode}
                      {p.barcode ? ` · ${p.barcode}` : ''}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <ProductFormModal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        onSuccess={handleCreated}
      />
    </>
  );
}
