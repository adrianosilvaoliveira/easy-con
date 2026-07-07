import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ActiveToggleField } from '@/components/ui/ActiveToggleField';
import { formatProductName, formatProductNameInput } from '@/utils/format';
import { CategoryFormModal } from '@/components/products/CategoryFormModal';
import { SupplierFormModal } from '@/components/suppliers/SupplierFormModal';
import { LocationFormModal } from '@/components/stock/LocationFormModal';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';
import { getApiErrorMessage } from '@/utils/apiError';

function selectOptionValues(
  items: { name: string }[] | undefined,
  current: string | undefined
): string[] {
  const names = items?.map((i) => i.name) ?? [];
  const value = current?.trim();
  if (value && !names.includes(value)) return [value, ...names];
  return names;
}

export const productSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  internalCode: z.string().max(50, 'Código muito longo').optional(),
  barcode: z.string().optional(),
  categoryId: z.string().uuid('Selecione a categoria'),
  manufacturer: z.string().optional(),
  unit: z.string().default('UN'),
  minQuantity: z.coerce.number().int().min(0),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;

export interface CreatedProduct {
  id: string;
  name: string;
  internalCode: string;
  active?: boolean;
}

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (product: CreatedProduct) => void;
  initialName?: string;
  productId?: string | null;
}

export function ProductFormModal({
  open,
  onClose,
  onSuccess,
  initialName = '',
  productId = null,
}: ProductFormModalProps) {
  const isEdit = !!productId;
  const queryClient = useQueryClient();
  const canCreateCategory = useAuthStore((s) => s.hasPermission('products:CREATE'));
  const canCreateSupplier = useAuthStore((s) => s.hasPermission('products:CREATE'));
  const canCreateLocation = useAuthStore((s) => s.hasPermission('stock:CREATE'));
  const [active, setActive] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/products/categories').then((r) => r.data.data),
    enabled: open,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () =>
      api.get('/suppliers', { params: { includeInactive: 'false' } }).then((r) => r.data.data),
    enabled: open,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data),
    enabled: open,
  });

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.get(`/products/${productId}`).then((r) => r.data.data),
    enabled: open && !!productId,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { unit: 'UN', minQuantity: 0 },
  });

  useEffect(() => {
    if (!open) return;
    if (product && isEdit) {
      reset({
        name: formatProductName(product.name),
        internalCode: product.internalCode,
        barcode: product.barcode || '',
        categoryId: product.categoryId,
        manufacturer: product.manufacturer || '',
        unit: product.unit || 'UN',
        minQuantity: product.minQuantity,
        location: product.location || '',
        notes: product.notes || '',
      });
      setActive(product.active ?? true);
    } else if (!isEdit) {
      reset({ unit: 'UN', minQuantity: 0, name: formatProductNameInput(initialName) });
      setActive(true);
    }
  }, [open, product, isEdit, initialName, reset]);

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => api.post('/products', data),
    onSuccess: (res) => {
      const p = res.data.data as CreatedProduct;
      toast.success(`Produto cadastrado — código ${p.internalCode}`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
      onSuccess?.(p);
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Erro ao salvar')),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProductFormData & { active: boolean }) =>
      api.put(`/products/${productId}`, data),
    onSuccess: (res) => {
      toast.success('Produto atualizado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      onSuccess?.(res.data.data);
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Erro ao atualizar')),
  });

  const onSubmit = (data: ProductFormData) => {
    const trimmedCode = data.internalCode?.trim();
    if (isEdit && !trimmedCode) {
      toast.error('Código interno obrigatório');
      return;
    }
    const payload = {
      ...data,
      name: formatProductName(data.name),
      ...(trimmedCode ? { internalCode: trimmedCode } : {}),
    };
    if (isEdit) {
      updateMutation.mutate({ ...payload, active, internalCode: trimmedCode! });
    } else {
      createMutation.mutate(payload);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Produto' : 'Novo Produto'}
      size="xl"
    >
      {loadingProduct && isEdit ? (
        <p className="py-8 text-center text-slate-500">Carregando...</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input
                  label="Nome *"
                  error={errors.name?.message}
                  {...field}
                  className="uppercase"
                  onChange={(e) => field.onChange(formatProductNameInput(e.target.value))}
                />
              )}
            />
          </div>
          <Input
            label="Código Interno"
            placeholder={isEdit ? undefined : 'Gerado automaticamente se vazio'}
            error={errors.internalCode?.message}
            {...register('internalCode')}
          />
          <Input label="Código de Barras" {...register('barcode')} />
          <div>
            <label className="form-label" htmlFor="product-category">
              Categoria *
            </label>
            <div
              className={cn(
                'flex overflow-hidden rounded-lg border bg-white shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 dark:bg-slate-800',
                errors.categoryId
                  ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-200'
                  : 'border-surface-border dark:border-slate-600'
              )}
            >
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="product-category"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-0 dark:text-slate-100"
                  >
                    <option value="">Selecione...</option>
                    {categories?.map((c: { id: string; name: string }) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {canCreateCategory && (
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(true)}
                  className="flex w-10 shrink-0 items-center justify-center border-l border-surface-border bg-primary-50 text-primary-600 transition hover:bg-primary-100 dark:border-slate-600 dark:bg-primary-950/50 dark:text-primary-400 dark:hover:bg-primary-900/50"
                  title="Cadastrar nova categoria"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>
            )}
          </div>
          <div>
            <label className="form-label" htmlFor="product-supplier">
              Fornecedor
            </label>
            <div
              className={cn(
                'flex overflow-hidden rounded-lg border bg-white shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 dark:bg-slate-800',
                'border-surface-border dark:border-slate-600'
              )}
            >
              <Controller
                name="manufacturer"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="product-supplier"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-0 dark:text-slate-100"
                  >
                    <option value="">Selecione...</option>
                    {selectOptionValues(suppliers, field.value).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {canCreateSupplier && (
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(true)}
                  className="flex w-10 shrink-0 items-center justify-center border-l border-surface-border bg-primary-50 text-primary-600 transition hover:bg-primary-100 dark:border-slate-600 dark:bg-primary-950/50 dark:text-primary-400 dark:hover:bg-primary-900/50"
                  title="Cadastrar novo fornecedor"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          <Input label="Unidade" {...register('unit')} />
          <Input label="Qtd. Mínima" type="number" {...register('minQuantity')} />
          <div>
            <label className="form-label" htmlFor="product-location">
              Localização
            </label>
            <div
              className={cn(
                'flex overflow-hidden rounded-lg border bg-white shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 dark:bg-slate-800',
                'border-surface-border dark:border-slate-600'
              )}
            >
              <Controller
                name="location"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="product-location"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-0 dark:text-slate-100"
                  >
                    <option value="">Selecione...</option>
                    {selectOptionValues(locations, field.value).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {canCreateLocation && (
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="flex w-10 shrink-0 items-center justify-center border-l border-surface-border bg-primary-50 text-primary-600 transition hover:bg-primary-100 dark:border-slate-600 dark:bg-primary-950/50 dark:text-primary-400 dark:hover:bg-primary-900/50"
                  title="Cadastrar novo local de estoque"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Input label="Observações" {...register('notes')} />
          </div>
          {isEdit && <ActiveToggleField active={active} onChange={setActive} />}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {isEdit ? 'Salvar alterações' : 'Salvar produto'}
            </Button>
          </div>
        </form>
      )}
    </Modal>

    <CategoryFormModal
      open={categoryModalOpen}
      onClose={() => setCategoryModalOpen(false)}
      onSuccess={(category) => setValue('categoryId', category.id, { shouldValidate: true })}
    />
    <SupplierFormModal
      open={supplierModalOpen}
      onClose={() => setSupplierModalOpen(false)}
      onSuccess={(supplier) => {
        queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        setValue('manufacturer', supplier.name, { shouldValidate: true });
      }}
    />
    <LocationFormModal
      open={locationModalOpen}
      onClose={() => setLocationModalOpen(false)}
      onSuccess={(location) => {
        queryClient.invalidateQueries({ queryKey: ['locations'] });
        setValue('location', location.name, { shouldValidate: true });
      }}
    />
  </>
  );
}
