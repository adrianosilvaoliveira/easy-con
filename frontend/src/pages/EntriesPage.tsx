import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ArrowDownToLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ProductSearchSelect } from '@/components/products/ProductSearchSelect';
import { SupplierSearchSelect } from '@/components/suppliers/SupplierSearchSelect';
import type { StockMovement, PaginatedResponse } from '@/types';
import { formatDateTime, movementTypeLabel, formatProductName } from '@/utils/format';
import {
  MovementApprovalActions,
  MovementStatusBadge,
} from '@/components/movements/MovementApprovalActions';

const batchLineSchema = z.object({
  batchNumber: z.string().min(1, 'Lote obrigatório'),
  manufacturingDate: z.string().min(1, 'Fabricação obrigatória'),
  expirationDate: z.string().min(1, 'Validade obrigatória'),
  quantity: z.coerce.number().int().positive('Qtd inválida'),
  unitPrice: z.coerce.number().positive().optional().or(z.literal('')),
});

const entrySchema = z
  .object({
    type: z.enum(['ENTRADA_COMPRA', 'ENTRADA_MANUAL', 'AJUSTE_ENTRADA', 'DEVOLUCAO']),
    productId: z.string().uuid('Selecione o produto'),
    destinationLocationId: z.string().uuid('Selecione o destino'),
    supplierId: z.string().uuid().optional().or(z.literal('')),
    invoiceNumber: z.string().optional(),
    reason: z.string().optional(),
    notes: z.string().optional(),
    batches: z.array(batchLineSchema).min(1, 'Adicione ao menos um lote'),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.batches.forEach((b, i) => {
      const key = b.batchNumber.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Lote duplicado',
          path: ['batches', i, 'batchNumber'],
        });
      }
      seen.add(key);
    });
  });

type EntryForm = z.infer<typeof entrySchema>;

const defaultBatchLine = (): EntryForm['batches'][0] => ({
  batchNumber: '',
  manufacturingDate: '',
  expirationDate: '',
  quantity: 1,
  unitPrice: undefined,
});

const defaultFormValues: EntryForm = {
  type: 'ENTRADA_COMPRA',
  productId: '',
  destinationLocationId: '',
  batches: [defaultBatchLine()],
};

export function EntriesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['entries'],
    queryFn: () =>
      api
        .get<PaginatedResponse<StockMovement>>('/movements', {
          params: { limit: 50 },
        })
        .then((r) => {
          const entryTypes = ['ENTRADA_COMPRA', 'ENTRADA_MANUAL', 'AJUSTE_ENTRADA', 'DEVOLUCAO'];
          return {
            ...r.data,
            data: r.data.data.filter((m) => entryTypes.includes(m.type)),
          };
        }),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    defaultValues: defaultFormValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'batches' });
  const watchedBatches = watch('batches');
  const totalQuantity = (watchedBatches || []).reduce(
    (sum, b) => sum + (Number(b?.quantity) || 0),
    0
  );

  const mutation = useMutation({
    mutationFn: (payload: EntryForm) => {
      const body = {
        ...payload,
        batches: payload.batches.map((b) => ({
          batchNumber: b.batchNumber.trim(),
          manufacturingDate: b.manufacturingDate,
          expirationDate: b.expirationDate,
          quantity: Number(b.quantity),
          unitPrice: b.unitPrice ? Number(b.unitPrice) : undefined,
        })),
        supplierId: payload.supplierId || undefined,
      };
      return api.post('/movements/entries', body);
    },
    onSuccess: (res) => {
      const { batchCount, totalQuantity: total, pendingApproval } = res.data.data;
      toast.success(
        pendingApproval
          ? `Entrada enviada para aprovação (${batchCount} lote(s), ${total} un.)`
          : `Entrada registrada: ${batchCount} lote(s), ${total} unidade(s) no total`
      );
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setModalOpen(false);
      reset(defaultFormValues);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao registrar entrada'),
  });

  const openModal = () => {
    reset(defaultFormValues);
    setModalOpen(true);
  };

  return (
    <div className="page-content">
      <PageHeader
        title="Entradas"
        action={
          <Button onClick={openModal} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Nova Entrada
          </Button>
        }
      />

      <DataTable<StockMovement>
        loading={isLoading}
        data={data?.data || []}
        emptyIcon={ArrowDownToLine}
        columns={[
          { key: 'date', header: 'Data', render: (m) => formatDateTime(m.movementDate) },
          {
            key: 'type',
            header: 'Tipo',
            render: (m) => <Badge variant="success">{movementTypeLabel(m.type)}</Badge>,
          },
          { key: 'product', header: 'Produto', render: (m) => formatProductName(m.product.name) },
          {
            key: 'lot',
            header: 'Lote',
            render: (m) =>
              (m as StockMovement & { batch?: { batchNumber: string } }).batch?.batchNumber || '-',
          },
          { key: 'qty', header: 'Qtd', render: (m) => m.quantity },
          { key: 'dest', header: 'Destino', render: (m) => m.destinationLocation?.name || '-' },
          { key: 'status', header: 'Status', render: (m) => <MovementStatusBadge status={m.status} /> },
          { key: 'user', header: 'Usuário', render: (m) => m.user.name },
          {
            key: 'actions',
            header: 'Ações',
            render: (m) => (
              <MovementApprovalActions movement={m} invalidateKeys={['entries']} />
            ),
          },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Entrada" size="3xl">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="form-label">Tipo</label>
              <select className="input-field" {...register('type')}>
                <option value="ENTRADA_COMPRA">Compra</option>
                <option value="ENTRADA_MANUAL">Manual</option>
                <option value="AJUSTE_ENTRADA">Ajuste</option>
                <option value="DEVOLUCAO">Devolução</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Controller
                name="productId"
                control={control}
                render={({ field }) => (
                  <ProductSearchSelect
                    value={field.value}
                    onChange={(id) => field.onChange(id)}
                    error={errors.productId?.message}
                    required
                  />
                )}
              />
            </div>
            <div>
              <label className="form-label">Destino *</label>
              <select className="input-field" {...register('destinationLocationId')}>
                <option value="">Selecione...</option>
                {locations?.map((l: { id: string; name: string }) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              {errors.destinationLocationId && (
                <p className="mt-1 text-xs text-red-600">{errors.destinationLocationId.message}</p>
              )}
            </div>
            <Input label="Nota Fiscal" {...register('invoiceNumber')} />
            <Controller
              name="supplierId"
              control={control}
              render={({ field }) => (
                <SupplierSearchSelect
                  value={field.value || ''}
                  onChange={(id) => field.onChange(id || undefined)}
                  placeholder="Buscar fornecedor ou deixar vazio..."
                  allowClear
                />
              )}
            />
            <Input label="Motivo" className="sm:col-span-2" {...register('reason')} />
            <Input label="Observações" className="sm:col-span-2" {...register('notes')} />
          </div>

          <div className="rounded-xl border border-surface-border bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-900/40">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Lotes desta entrada</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Um produto pode entrar em vários lotes com validades diferentes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600">
                  Total: <strong>{totalQuantity}</strong> un.
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => append(defaultBatchLine())}
                >
                  <Plus className="h-4 w-4" /> Lote
                </Button>
              </div>
            </div>

            {errors.batches?.message && (
              <p className="mb-2 text-xs text-red-600">{errors.batches.message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800/80 dark:shadow-none"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Lote {index + 1}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                        aria-label="Remover lote"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Input
                      label="Nº do Lote *"
                      error={errors.batches?.[index]?.batchNumber?.message}
                      {...register(`batches.${index}.batchNumber`)}
                    />
                    <Input
                      label="Fabricação *"
                      type="date"
                      error={errors.batches?.[index]?.manufacturingDate?.message}
                      {...register(`batches.${index}.manufacturingDate`)}
                    />
                    <Input
                      label="Validade *"
                      type="date"
                      error={errors.batches?.[index]?.expirationDate?.message}
                      {...register(`batches.${index}.expirationDate`)}
                    />
                    <Input
                      label="Quantidade *"
                      type="number"
                      min={1}
                      error={errors.batches?.[index]?.quantity?.message}
                      {...register(`batches.${index}.quantity`)}
                    />
                    <Input
                      label="Valor unitário"
                      type="number"
                      step="0.01"
                      {...register(`batches.${index}.unitPrice`)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Registrar {fields.length} lote(s) · {totalQuantity} un.
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
