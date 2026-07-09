import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import type { StockMovement, PaginatedResponse, StockItem } from '@/types';
import { formatDateTime, formatProductName } from '@/utils/format';
import {
  MovementStatusBadge,
} from '@/components/movements/MovementApprovalActions';
import { MovementDetailsModal } from '@/components/movements/MovementDetailsModal';
import { ProductSearchSelect } from '@/components/products/ProductSearchSelect';

const transferSchema = z.object({
  type: z.literal('TRANSFERENCIA'),
  productId: z.string().uuid(),
  originLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().optional(),
});

export function TransfersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const queryClient = useQueryClient();

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transfers'],
    queryFn: () =>
      api
        .get<PaginatedResponse<StockMovement>>('/movements', {
          params: { type: 'TRANSFERENCIA', limit: 50 },
        })
        .then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { type: 'TRANSFERENCIA', productId: '' },
  });

  const watchedProductId = watch('productId');
  const watchedOriginId = watch('originLocationId');

  const { data: productStock } = useQuery({
    queryKey: ['stock-items', 'transfer-origin', watchedProductId],
    queryFn: () =>
      api
        .get('/stock/items', { params: { productId: watchedProductId, limit: 100 } })
        .then((r) => r.data.data as StockItem[]),
    enabled: modalOpen && !!watchedProductId,
  });

  const originOptions = useMemo(() => {
    const byLocation = new Map<string, { id: string; name: string; quantity: number }>();
    for (const item of productStock ?? []) {
      if (item.quantity <= 0) continue;
      const existing = byLocation.get(item.location.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        byLocation.set(item.location.id, {
          id: item.location.id,
          name: item.location.name,
          quantity: item.quantity,
        });
      }
    }
    return [...byLocation.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [productStock]);

  useEffect(() => {
    if (!watchedOriginId) return;
    if (!originOptions.some((o) => o.id === watchedOriginId)) {
      setValue('originLocationId', '' as never);
    }
  }, [watchedOriginId, originOptions, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof transferSchema>) => api.post('/movements/transfers', data),
    onSuccess: (res) => {
      const status = res.data.data?.status;
      toast.success(
        status === 'PENDENTE'
          ? 'Transferência enviada para aprovação'
          : 'Transferência efetivada'
      );
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-locations'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setModalOpen(false);
      reset();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao registrar transferência'),
  });

  return (
    <div className="page-content">
      <PageHeader
        title="Transferências"
        action={
          <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Nova Transferência
          </Button>
        }
      />

      <DataTable<StockMovement>
        loading={isLoading}
        data={data?.data || []}
        emptyIcon={ArrowLeftRight}
        onRowClick={(m) => setSelectedMovement(m)}
        columns={[
          { key: 'date', header: 'Data', render: (m) => formatDateTime(m.movementDate) },
          { key: 'product', header: 'Produto', render: (m) => formatProductName(m.product.name) },
          { key: 'origin', header: 'Origem', render: (m) => m.originLocation?.name },
          { key: 'dest', header: 'Destino', render: (m) => m.destinationLocation?.name },
          { key: 'qty', header: 'Qtd', render: (m) => m.quantity },
          { key: 'status', header: 'Status', render: (m) => <MovementStatusBadge status={m.status} /> },
          { key: 'user', header: 'Usuário', render: (m) => m.user.name },
        ]}
      />

      {selectedMovement && (
        <MovementDetailsModal
          open
          onClose={() => setSelectedMovement(null)}
          movement={selectedMovement}
          invalidateKeys={['transfers']}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Transferência" size="lg">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Controller
              name="productId"
              control={control}
              render={({ field }) => (
                <ProductSearchSelect
                  value={field.value}
                  onChange={(id) => {
                    field.onChange(id);
                    setValue('originLocationId', '' as never);
                  }}
                  error={errors.productId?.message}
                  required
                />
              )}
            />
          </div>
          <div>
            <label className="form-label">Origem</label>
            <select
              className="input-field"
              disabled={!watchedProductId}
              {...register('originLocationId')}
            >
              <option value="">
                {!watchedProductId
                  ? 'Selecione o produto primeiro'
                  : originOptions.length === 0
                    ? 'Sem estoque disponível'
                    : 'Selecione...'}
              </option>
              {originOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.quantity} un.)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Destino</label>
            <select className="input-field" {...register('destinationLocationId')}>
              <option value="">Selecione...</option>
              {locations
                ?.filter((l: { id: string }) => l.id !== watchedOriginId)
                .map((l: { id: string; name: string }) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </div>
          <Input label="Quantidade" type="number" {...register('quantity')} />
          <Input label="Motivo" {...register('reason')} />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={createMutation.isPending}>Solicitar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
