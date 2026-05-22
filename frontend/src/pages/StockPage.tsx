import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, MapPin, AlertTriangle, Search } from 'lucide-react';
import api from '@/services/api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import type { StockLocation, StockItem } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';

export function StockPage() {
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

  return (
    <div className="page-content">
      <PageHeader title="Estoque" />

      {loadingLoc ? (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {locations?.map((loc) => (
            <div key={loc.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary-600" />
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
          ))}
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
    </div>
  );
}
