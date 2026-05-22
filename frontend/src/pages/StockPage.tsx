import { useState, useMemo, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, MapPin, AlertTriangle, Search, X } from 'lucide-react';
import api from '@/services/api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ProductCatalogPanel } from '@/components/products/ProductCatalogPanel';
import type { StockLocation, StockItem } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';

type StockTab = 'itens' | 'produtos';

export function StockPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canViewProducts = hasPermission('products:READ');
  const [searchParams, setSearchParams] = useSearchParams();

  const tab: StockTab =
    canViewProducts && searchParams.get('aba') === 'produtos' ? 'produtos' : 'itens';

  const setTab = (next: StockTab) => {
    if (next === 'produtos') setSearchParams({ aba: 'produtos' });
    else setSearchParams({});
  };

  const stockTabs: { id: StockTab; label: string }[] = [
    { id: 'itens', label: 'Saldo por lote' },
    ...(canViewProducts ? [{ id: 'produtos' as const, label: 'Produtos' }] : []),
  ];

  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [batch, setBatch] = useState('');

  const { data: locations, isLoading: loadingLoc } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data as StockLocation[]),
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['stock-items', search, locationId, batch],
    queryFn: () =>
      api
        .get('/stock/items', {
          params: {
            search: search.trim() || undefined,
            locationId: locationId || undefined,
            batch: batch.trim() || undefined,
            limit: 100,
          },
        })
        .then((r) => r.data),
  });

  const { data: alerts } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: () => api.get('/stock/alerts').then((r) => r.data.data),
  });

  const total = items?.meta?.total;

  const selectedLocation = useMemo(
    () => locations?.find((loc) => loc.id === locationId),
    [locations, locationId]
  );

  const toggleLocationFilter = (id: string) => {
    setLocationId((current) => (current === id ? '' : id));
  };

  const handleLocationCardKeyDown = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleLocationFilter(id);
    }
  };

  return (
    <div className="page-content">
      <PageHeader title="Estoque" />

      {stockTabs.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-surface-border pb-2 dark:border-slate-600">
          {stockTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition',
                tab === t.id
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'produtos' ? (
        <ProductCatalogPanel allowEdit />
      ) : (
        <>

      {loadingLoc ? (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {locations?.map((loc) => {
            const selected = locationId === loc.id;
            return (
              <div
                key={loc.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleLocationFilter(loc.id)}
                onKeyDown={(e) => handleLocationCardKeyDown(e, loc.id)}
                aria-pressed={selected}
                aria-label={`Filtrar por ${loc.name}${selected ? ' (ativo, clique para remover)' : ''}`}
                className={cn(
                  'card w-full cursor-pointer text-left outline-none transition select-none',
                  'hover:border-primary-400 hover:shadow-md dark:hover:border-primary-500',
                  'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                  selected &&
                    'border-2 border-primary-500 bg-primary-50 shadow-md dark:border-primary-400 dark:bg-primary-950/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin
                        className={cn(
                          'h-4 w-4',
                          selected ? 'text-primary-700 dark:text-primary-300' : 'text-primary-600'
                        )}
                      />
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{loc.name}</h3>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{loc.code}</p>
                    <Badge variant="info" className="mt-2">
                      {loc.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-700 dark:text-primary-400">
                      {loc.totalQuantity ?? 0}
                    </p>
                    <p className="text-xs text-slate-400">unidades</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedLocation && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm dark:border-primary-800 dark:bg-primary-950/40">
          <p className="text-slate-700 dark:text-slate-200">
            Filtrando por <span className="font-semibold text-primary-800 dark:text-primary-200">{selectedLocation.name}</span>
            {typeof total === 'number' && (
              <span className="text-slate-500 dark:text-slate-400"> — {total} registro(s)</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setLocationId('')}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-700 transition hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900/60"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtro
          </button>
        </div>
      )}

      {(alerts?.belowMin?.length > 0 || alerts?.expiring?.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {alerts.belowMin.length > 0 && (
            <div className="card border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/30">
              <h3 className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" /> Abaixo do Mínimo ({alerts.belowMin.length})
              </h3>
              <ul className="mt-3 space-y-1 text-sm">
                {alerts.belowMin.map((p: { name: string; current: number; minQuantity: number }) => (
                  <li key={p.name} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-red-600 dark:text-red-400">
                      {p.current}/{p.minQuantity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="card space-y-4 !p-4 sm:!p-5">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="form-label" htmlFor="stock-search">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="stock-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Produto, código ou barras..."
                className="input-field w-full pl-9"
              />
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="stock-location">
              Local
            </label>
            <select
              id="stock-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Todos os locais</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="stock-batch">
              Lote
            </label>
            <input
              id="stock-batch"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="Nº do lote..."
              className="input-field w-full"
            />
          </div>
        </div>
        {typeof total === 'number' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {total} registro(s) encontrado(s)
            {total > 100 ? ' — exibindo os primeiros 100' : ''}
          </p>
        )}
      </div>

      <DataTable<StockItem>
        loading={loadingItems}
        data={items?.data || []}
        emptyIcon={Boxes}
        emptyTitle="Nenhum item encontrado"
        emptyDescription="Ajuste os filtros ou cadastre entradas de estoque."
        columns={[
          { key: 'product', header: 'Produto', render: (i) => i.product.name },
          { key: 'code', header: 'Código', render: (i) => i.product.internalCode },
          { key: 'location', header: 'Local', render: (i) => i.location.name },
          { key: 'lot', header: 'Lote', render: (i) => i.batch?.batchNumber || '-' },
          {
            key: 'qty',
            header: 'Quantidade',
            render: (i) => <span className="font-semibold">{i.quantity}</span>,
          },
        ]}
      />
        </>
      )}
    </div>
  );
}
