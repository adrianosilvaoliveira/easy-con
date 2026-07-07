import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { ExpirationBadge, ExpirationStatusType } from '@/components/expiration/ExpirationBadge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDate, formatProductName } from '@/utils/format';
import { useAuthStore } from '@/stores/authStore';
import { useDebounce } from '@/hooks/useDebounce';
import { IncludeInactiveFilter } from '@/components/ui/IncludeInactiveFilter';
import { ProductSearchSelect } from '@/components/products/ProductSearchSelect';
import { Controller } from 'react-hook-form';

interface ProductBatch {
  id: string;
  batchNumber: string;
  expirationDate: string;
  manufacturingDate?: string;
  quantity: number;
  status: ExpirationStatusType;
  daysUntilExpiration?: number;
  product: { id: string; name: string; internalCode: string; category?: { name: string } };
  stockLocation: { id: string; name: string; code: string };
  supplier?: { name: string };
}

const batchSchema = z.object({
  productId: z.string().uuid(),
  stockLocationId: z.string().uuid(),
  batchNumber: z.string().min(1),
  expirationDate: z.string().min(1),
  manufacturingDate: z.string().min(1),
  quantity: z.coerce.number().int().min(0),
  supplierId: z.string().optional(),
  unitCost: z.coerce.number().optional(),
});

export function ExpirationsPage() {
  const [tab, setTab] = useState<'all' | 'expiring' | 'expired'>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<ProductBatch | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const debouncedSearch = useDebounce(search, 350);

  const endpoint =
    tab === 'expired' ? '/batches/expired' : tab === 'expiring' ? '/batches/expiring?days=90' : '/batches';

  const { data, isLoading } = useQuery({
    queryKey: ['batches', tab, debouncedSearch, statusFilter, includeInactive],
    queryFn: () =>
      api
        .get(endpoint, {
          params: {
            search: debouncedSearch,
            status: statusFilter || undefined,
            includeInactive: includeInactive ? 'true' : undefined,
            limit: 100,
          },
        })
        .then((r) => r.data),
  });

  const { data: metrics } = useQuery({
    queryKey: ['batches-dashboard'],
    queryFn: () => api.get('/batches/dashboard').then((r) => r.data.data),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, control } = useForm<z.infer<typeof batchSchema>>({
    resolver: zodResolver(batchSchema),
    defaultValues: { quantity: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (body: z.infer<typeof batchSchema>) => api.post('/batches', body),
    onSuccess: () => {
      toast.success('Lote cadastrado');
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setModalOpen(false);
      reset();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao salvar lote'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      api.put(`/batches/${payload.id}`, payload.data),
    onSuccess: () => {
      toast.success('Lote atualizado');
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setEditBatch(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao atualizar'),
  });

  const downloadPdf = async (type: string) => {
    try {
      const res = await api.get(`/reports/${type}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao gerar PDF');
    }
  };

  const batches: ProductBatch[] = data?.data || [];

  return (
    <div className="page-content">
      <PageHeader
        title="Controle de Vencimentos"
        action={
          hasPermission('batches:CREATE') ? (
            <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Novo Lote
            </Button>
          ) : undefined
        }
      />

      {metrics && (
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          <div className="card border-red-200 bg-red-50/40 p-4">
            <p className="text-xs text-red-600">Vencidos</p>
            <p className="text-2xl font-bold text-red-700">{metrics.counts.expired}</p>
          </div>
          <div className="card border-orange-200 bg-orange-50/40 p-4">
            <p className="text-xs text-orange-600">Críticos</p>
            <p className="text-2xl font-bold text-orange-700">{metrics.counts.critical}</p>
          </div>
          <div className="card border-amber-200 bg-amber-50/40 p-4">
            <p className="text-xs text-amber-700">Atenção</p>
            <p className="text-2xl font-bold text-amber-800">{metrics.counts.warning}</p>
          </div>
          <div className="card border-emerald-200 bg-emerald-50/40 p-4">
            <p className="text-xs text-emerald-600">Válidos</p>
            <p className="text-2xl font-bold text-emerald-700">{metrics.counts.valid}</p>
          </div>
          <div className="card p-4 sm:col-span-2 lg:col-span-2">
            <p className="text-xs text-slate-500">Perda financeira (vencidos)</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                metrics.financialLoss || 0
              )}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', 'expiring', 'expired'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'expiring' ? 'Vencendo' : 'Vencidos'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadPdf('expiring')}>
            <Download className="h-4 w-4" /> PDF Vencendo
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadPdf('expired')}>
            <Download className="h-4 w-4" /> PDF Vencidos
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto, lote..."
            className="input-field pl-9"
          />
        </div>
        <select
          className="input-field w-full sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="VALID">Válido</option>
          <option value="WARNING">Atenção</option>
          <option value="CRITICAL">Crítico</option>
          <option value="EXPIRED">Vencido</option>
        </select>
        <IncludeInactiveFilter checked={includeInactive} onChange={setIncludeInactive} />
      </div>

      <DataTable<ProductBatch>
        loading={isLoading}
        data={batches}
        emptyIcon={AlertTriangle}
        emptyTitle="Nenhum lote encontrado"
        onRowClick={
          hasPermission('batches:UPDATE') ? (batch) => setEditBatch(batch) : undefined
        }
        columns={[
          { key: 'product', header: 'Produto', render: (b) => (
            <div>
              <p className="font-medium">{formatProductName(b.product.name)}</p>
              <p className="text-xs text-slate-500">{b.product.internalCode}</p>
            </div>
          )},
          { key: 'batch', header: 'Lote', render: (b) => <span className="font-mono text-xs">{b.batchNumber}</span> },
          { key: 'location', header: 'Local', render: (b) => b.stockLocation.name, hideBelow: 'md' },
          { key: 'expiry', header: 'Validade', render: (b) => formatDate(b.expirationDate) },
          { key: 'qty', header: 'Qtd', render: (b) => b.quantity },
          { key: 'status', header: 'Status', render: (b) => (
            <ExpirationBadge status={b.status} days={b.daysUntilExpiration} />
          )},
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Lote" size="lg">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Controller
              name="productId"
              control={control}
              render={({ field }) => (
                <ProductSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                />
              )}
            />
          </div>
          <div>
            <label className="form-label">Local</label>
            <select className="input-field" {...register('stockLocationId')}>
              <option value="">Selecione...</option>
              {locations?.map((l: { id: string; name: string }) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <Input label="Nº do Lote" {...register('batchNumber')} />
          <Input label="Data Fabricação" type="date" {...register('manufacturingDate')} />
          <Input label="Data Validade" type="date" {...register('expirationDate')} />
          <Input label="Quantidade" type="number" {...register('quantity')} />
          <Input label="Custo Unitário" type="number" step="0.01" {...register('unitCost')} />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={createMutation.isPending}>Salvar</Button>
          </div>
        </form>
      </Modal>

      {editBatch && (
        <BatchEditModal
          batch={editBatch}
          onClose={() => setEditBatch(null)}
          onSave={(data) => updateMutation.mutate({ id: editBatch.id, data })}
          loading={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function BatchEditModal({
  batch,
  onClose,
  onSave,
  loading,
}: {
  batch: ProductBatch;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [batchNumber, setBatchNumber] = useState(batch.batchNumber);
  const [expirationDate, setExpirationDate] = useState(batch.expirationDate.slice(0, 10));
  const [manufacturingDate, setManufacturingDate] = useState(
    batch.manufacturingDate?.slice(0, 10) || ''
  );
  const [quantity, setQuantity] = useState(String(batch.quantity));
  const [unitCost, setUnitCost] = useState('');

  return (
    <Modal open onClose={onClose} title="Editar Lote" size="lg">
      <p className="mb-4 text-sm text-slate-600">
        {formatProductName(batch.product.name)} · {batch.stockLocation.name}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nº do Lote" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
        <Input label="Fabricação" type="date" value={manufacturingDate} onChange={(e) => setManufacturingDate(e.target.value)} />
        <Input label="Validade" type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
        <Input label="Quantidade" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Input label="Custo unitário" type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        <p className="text-xs text-slate-500 sm:col-span-2">
          Para inativar o lote, zere a quantidade após baixa por vencimento ou descarte.
        </p>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            loading={loading}
            onClick={() =>
              onSave({
                batchNumber,
                manufacturingDate,
                expirationDate,
                quantity: Number(quantity),
                ...(unitCost ? { unitCost: Number(unitCost) } : {}),
              })
            }
          >
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
