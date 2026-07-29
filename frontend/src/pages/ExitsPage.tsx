import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ArrowUpFromLine } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ProductSearchSelect, type ProductOption } from '@/components/products/ProductSearchSelect';
import { KitBadge } from '@/components/products/ProductTypeSelect';
import type { Product, StockMovement, PaginatedResponse } from '@/types';
import { formatDateTime, movementTypeLabel, formatProductName } from '@/utils/format';
import {
  MovementStatusBadge,
} from '@/components/movements/MovementApprovalActions';
import { MovementDetailsModal } from '@/components/movements/MovementDetailsModal';
import { BatchSelectField } from '@/components/movements/BatchSelectField';
import { StockOriginSelect } from '@/components/movements/StockOriginSelect';
import { useAvailableLots } from '@/hooks/queries/useAvailableLots';
import { useProductStockOrigins } from '@/hooks/queries/useProductStockOrigins';
import { useLocations } from '@/hooks/queries/useLocations';
import { Pagination } from '@/components/ui/Pagination';
import { getApiErrorMessage } from '@/utils/apiError';

const PAGE_SIZE = 20;

const optionalUuid = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional()
);

const exitSchema = z.object({
  type: z.enum(['SAIDA_CONSUMO', 'SAIDA_CIRURGIA', 'SAIDA_CONSULTA', 'SAIDA_PERDA', 'SAIDA_VENCIMENTO']),
  productId: z.string().uuid(),
  originLocationId: z.string().uuid(),
  batchId: optionalUuid,
  quantity: z.coerce.number().int().positive(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type ExitForm = z.infer<typeof exitSchema>;

export function ExitsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['exits', page],
    queryFn: () =>
      api
        .get<PaginatedResponse<StockMovement>>('/movements', {
          params: { category: 'exit', page, limit: PAGE_SIZE },
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
  } = useForm<ExitForm>({
    resolver: zodResolver(exitSchema),
    defaultValues: { type: 'SAIDA_CONSUMO', productId: '', batchId: undefined },
  });

  const watchedProductId = watch('productId');
  const watchedOriginId = watch('originLocationId');
  const isKit = selectedProduct?.productType === 'KIT';

  const { origins: productOrigins, isLoading: originsLoading } = useProductStockOrigins(
    isKit ? undefined : watchedProductId,
    modalOpen && !isKit
  );

  const { data: allLocations, isLoading: locationsLoading } = useLocations();

  const kitOrigins = useMemo(
    () =>
      (allLocations ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        quantity: 0,
      })),
    [allLocations]
  );

  const origins = isKit ? kitOrigins : productOrigins;
  const originsBusy = isKit ? locationsLoading : originsLoading;

  const { data: kitDetail } = useQuery({
    queryKey: ['product', watchedProductId, 'kit-exit'],
    queryFn: () => api.get(`/products/${watchedProductId}`).then((r) => r.data.data as Product),
    enabled: modalOpen && isKit && !!watchedProductId,
  });

  const { lots, hasLots, isLoading: lotsLoading } = useAvailableLots(
    isKit ? undefined : watchedProductId,
    watchedOriginId,
    modalOpen && !isKit
  );

  useEffect(() => {
    if (!watchedProductId) {
      setValue('originLocationId', '' as never);
      return;
    }
    if (origins.length === 1) {
      setValue('originLocationId', origins[0].id as never);
      return;
    }
    if (watchedOriginId && !origins.some((o) => o.id === watchedOriginId)) {
      setValue('originLocationId', '' as never);
    }
  }, [watchedProductId, watchedOriginId, origins, setValue]);

  useEffect(() => {
    setValue('batchId', undefined);
    clearErrors('batchId');
  }, [watchedProductId, watchedOriginId, setValue, clearErrors]);

  useEffect(() => {
    if (!isKit && lots.length === 1) {
      setValue('batchId', lots[0].batchId);
    }
  }, [lots, setValue, isKit]);

  const mutation = useMutation({
    mutationFn: (data: ExitForm) =>
      api.post('/movements/exits', {
        ...data,
        batchId: isKit ? undefined : data.batchId || undefined,
      }),
    onSuccess: (res) => {
      const pendingApproval = res.data.data?.pendingApproval;
      toast.success(
        pendingApproval
          ? 'Saída enviada para aprovação'
          : isKit
            ? 'Saída de kit registrada — estoque dos componentes atualizado'
            : 'Saída registrada'
      );
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setModalOpen(false);
      setSelectedProduct(null);
      reset();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Erro ao registrar saída')),
  });

  const onSubmit = (data: ExitForm) => {
    if (!isKit && hasLots && !data.batchId) {
      setError('batchId', { message: 'Selecione o lote para a movimentação' });
      return;
    }
    mutation.mutate(data);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
    reset();
  };

  return (
    <div className="page-content">
      <PageHeader
        title="Saídas"
        action={
          <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Nova Saída
          </Button>
        }
      />

      <DataTable<StockMovement>
        loading={isLoading}
        data={data?.data || []}
        emptyIcon={ArrowUpFromLine}
        onRowClick={(m) => setSelectedMovement(m)}
        columns={[
          { key: 'date', header: 'Data', render: (m) => formatDateTime(m.movementDate) },
          { key: 'type', header: 'Tipo', render: (m) => <Badge variant="warning">{movementTypeLabel(m.type)}</Badge> },
          {
            key: 'product',
            header: 'Produto',
            render: (m) => (
              <span className="flex items-center gap-2">
                {formatProductName(m.product.name)}
                {(m.product as { productType?: string }).productType === 'KIT' && <KitBadge />}
              </span>
            ),
          },
          { key: 'qty', header: 'Qtd', render: (m) => m.quantity },
          { key: 'origin', header: 'Origem', render: (m) => m.originLocation?.name || '-' },
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
          invalidateKeys={['exits']}
        />
      )}

      <Modal open={modalOpen} onClose={closeModal} title="Nova Saída" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="form-label">Tipo</label>
            <select className="input-field" {...register('type')}>
              <option value="SAIDA_CONSUMO">Consumo Interno</option>
              <option value="SAIDA_CIRURGIA">Cirurgia</option>
              <option value="SAIDA_CONSULTA">Consulta</option>
              <option value="SAIDA_PERDA">Perda</option>
              <option value="SAIDA_VENCIMENTO">Vencimento</option>
            </select>
          </div>
          <div>
            <Controller
              name="productId"
              control={control}
              render={({ field }) => (
                <ProductSearchSelect
                  value={field.value}
                  onChange={(id, product) => {
                    field.onChange(id);
                    setSelectedProduct(product ?? null);
                    setValue('originLocationId', '' as never);
                    setValue('batchId', undefined);
                  }}
                  error={errors.productId?.message}
                  required
                />
              )}
            />
          </div>
          <Controller
            name="originLocationId"
            control={control}
            render={({ field }) => (
              <StockOriginSelect
                value={field.value}
                onChange={(id) => {
                  field.onChange(id);
                  setValue('batchId', undefined);
                }}
                origins={origins}
                productSelected={!!watchedProductId}
                loading={originsBusy}
                error={errors.originLocationId?.message}
                label={isKit ? 'Local de baixa dos componentes' : 'Origem'}
              />
            )}
          />
          {!isKit && (
            <Controller
              name="batchId"
              control={control}
              render={({ field }) => (
                <BatchSelectField
                  lots={lots}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.batchId?.message}
                  loading={lotsLoading && !!watchedOriginId}
                />
              )}
            />
          )}
          <Input
            label={isKit ? 'Quantidade de kits' : 'Quantidade'}
            type="number"
            {...register('quantity')}
          />
          <Input label="Motivo" {...register('reason')} />

          {isKit && (
            <div className="sm:col-span-2 rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-3 text-sm dark:border-teal-800 dark:bg-teal-950/30">
              <p className="mb-2 flex items-center gap-2 font-medium text-teal-900 dark:text-teal-100">
                <KitBadge /> Baixa automática dos componentes
              </p>
              <p className="mb-2 text-xs text-teal-800 dark:text-teal-200">
                Ao registrar, o estoque de cada produto do kit será descontado no local selecionado
                (lote do kit quando houver; senão FEFO).
              </p>
              {kitDetail?.kitItems && kitDetail.kitItems.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {kitDetail.kitItems.map((ki) => (
                    <li key={ki.id}>
                      {formatProductName(ki.componentProduct.name)} × {ki.quantity}
                      {ki.batch?.batchNumber ? ` · lote ${ki.batch.batchNumber}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Carregando composição...</p>
              )}
            </div>
          )}

          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Registrar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
