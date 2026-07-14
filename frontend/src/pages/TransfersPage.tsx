import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import type { StockMovement, PaginatedResponse } from '@/types';
import { formatDateTime, formatProductName } from '@/utils/format';
import {
  MovementStatusBadge,
} from '@/components/movements/MovementApprovalActions';
import { MovementDetailsModal } from '@/components/movements/MovementDetailsModal';
import { BatchSelectField } from '@/components/movements/BatchSelectField';
import { ProductSearchSelect } from '@/components/products/ProductSearchSelect';
import { useLocations } from '@/hooks/queries/useLocations';
import { useAvailableLots } from '@/hooks/queries/useAvailableLots';
import { useProductStockOrigins } from '@/hooks/queries/useProductStockOrigins';
import { queryKeys } from '@/lib/queryKeys';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 20;

const optionalUuid = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional()
);

const transferSchema = z.object({
  type: z.literal('TRANSFERENCIA'),
  productId: z.string().uuid(),
  originLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  batchId: optionalUuid,
  quantity: z.coerce.number().int().positive(),
  reason: z.string().optional(),
});

type TransferForm = z.infer<typeof transferSchema>;

export function TransfersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const queryClient = useQueryClient();

  const { data: locations } = useLocations();

  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', page],
    queryFn: () =>
      api
        .get<PaginatedResponse<StockMovement>>('/movements', {
          params: { type: 'TRANSFERENCIA', page, limit: PAGE_SIZE },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: { type: 'TRANSFERENCIA', productId: '', batchId: undefined },
  });

  const watchedProductId = watch('productId');
  const watchedOriginId = watch('originLocationId');

  const { origins: originOptions, isLoading: originsLoading } = useProductStockOrigins(
    watchedProductId,
    modalOpen
  );

  const { lots, hasMultipleLots, isLoading: lotsLoading } = useAvailableLots(
    watchedProductId,
    watchedOriginId,
    modalOpen
  );

  useEffect(() => {
    if (!watchedOriginId) return;
    if (!originOptions.some((o) => o.id === watchedOriginId)) {
      setValue('originLocationId', '' as never);
    }
  }, [watchedOriginId, originOptions, setValue]);

  useEffect(() => {
    setValue('batchId', undefined);
    clearErrors('batchId');
  }, [watchedProductId, watchedOriginId, setValue, clearErrors]);

  useEffect(() => {
    if (lots.length === 1) {
      setValue('batchId', lots[0].batchId);
    }
  }, [lots, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: TransferForm) =>
      api.post('/movements/transfers', {
        ...data,
        batchId: data.batchId || undefined,
      }),
    onSuccess: (res) => {
      const status = res.data.data?.status;
      toast.success(
        status === 'PENDENTE'
          ? 'Transferência enviada para aprovação'
          : 'Transferência efetivada'
      );
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockLocations });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setModalOpen(false);
      reset();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao registrar transferência'),
  });

  const onSubmit = (data: TransferForm) => {
    if (hasMultipleLots && !data.batchId) {
      setError('batchId', { message: 'Selecione o lote para a movimentação' });
      return;
    }
    createMutation.mutate(data);
  };

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

      <Pagination meta={data?.meta} page={page} onPageChange={setPage} loading={isLoading} />

      {selectedMovement && (
        <MovementDetailsModal
          open
          onClose={() => setSelectedMovement(null)}
          movement={selectedMovement}
          invalidateKeys={['transfers']}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Transferência" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
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
                    setValue('batchId', undefined);
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
              disabled={!watchedProductId || originsLoading}
              {...register('originLocationId', {
                onChange: () => setValue('batchId', undefined),
              })}
            >
              <option value="">
                {!watchedProductId
                  ? 'Selecione o produto primeiro'
                  : originsLoading
                    ? 'Carregando estoque...'
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
          <Controller
            name="batchId"
            control={control}
            render={({ field }) => (
              <BatchSelectField
                lots={lots}
                value={field.value}
                onChange={field.onChange}
                error={errors.batchId?.message}
                loading={lotsLoading}
              />
            )}
          />
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
