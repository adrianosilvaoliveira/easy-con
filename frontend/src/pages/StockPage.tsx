import { useQuery } from '@tanstack/react-query';
import { Boxes, MapPin, AlertTriangle } from 'lucide-react';
import api from '@/services/api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import type { StockLocation, StockItem } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';

export function StockPage() {
  const { data: locations, isLoading: loadingLoc } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data as StockLocation[]),
  });

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['stock-items'],
    queryFn: () => api.get('/stock/items', { params: { limit: 100 } }).then((r) => r.data),
  });

  const { data: alerts } = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: () => api.get('/stock/alerts').then((r) => r.data.data),
  });

  return (
    <div className="page-content">
      <PageHeader title="Estoque" />

      {loadingLoc ? (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {locations?.map((loc) => (
            <div key={loc.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary-600" />
                    <h3 className="font-semibold text-slate-900">{loc.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 font-mono">{loc.code}</p>
                  <Badge variant="info" className="mt-2">{loc.type.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary-700">{loc.totalQuantity ?? 0}</p>
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
            <div className="card border-red-200 bg-red-50/30">
              <h3 className="flex items-center gap-2 font-semibold text-red-700">
                <AlertTriangle className="h-5 w-5" /> Abaixo do Mínimo ({alerts.belowMin.length})
              </h3>
              <ul className="mt-3 space-y-1 text-sm">
                {alerts.belowMin.map((p: { name: string; current: number; minQuantity: number }) => (
                  <li key={p.name} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-red-600">{p.current}/{p.minQuantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Itens em Estoque</h2>
        <DataTable<StockItem>
          loading={loadingItems}
          data={items?.data || []}
          emptyIcon={Boxes}
          emptyTitle="Nenhum item em estoque"
          columns={[
            { key: 'product', header: 'Produto', render: (i) => i.product.name },
            { key: 'code', header: 'Código', render: (i) => i.product.internalCode },
            { key: 'location', header: 'Local', render: (i) => i.location.name },
            { key: 'lot', header: 'Lote', render: (i) => i.batch?.batchNumber || '-' },
            { key: 'qty', header: 'Quantidade', render: (i) => <span className="font-semibold">{i.quantity}</span> },
          ]}
        />
      </div>
    </div>
  );
}
