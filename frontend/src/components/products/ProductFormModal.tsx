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
import { formatProductName } from '@/utils/format';
import { CategoryFormModal } from '@/components/products/CategoryFormModal';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

export const productSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome obrigatório')
    .transform((value) => formatProductName(value)),
  internalCode: z.string().min(1, 'Código obrigatório'),
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
  const [active, setActive] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/products/categories').then((r) => r.data.data),
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
      reset({ unit: 'UN', minQuantity: 0, name: formatProductName(initialName) });
      setActive(true);
    }
  }, [open, product, isEdit, initialName, reset]);

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => api.post('/products', data),
    onSuccess: (res) => {
      const p = res.data.data as CreatedProduct;
      toast.success('Produto cadastrado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
      onSuccess?.(p);
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao salvar'),
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
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao atualizar'),
  });

  const onSubmit = (data: ProductFormData) => {
    const payload = { ...data, name: formatProductName(data.name) };
    if (isEdit) {
      updateMutation.mutate({ ...payload, active });
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
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                label="Nome *"
                error={errors.name?.message}
                {...field}
                className="uppercase"
                onChange={(e) => field.onChange(formatProductName(e.target.value))}
              />
            )}
          />
          <Input label="Código Interno *" error={errors.internalCode?.message} {...register('internalCode')} />
          <Input label="Código de Barras" {...register('barcode')} />
          <div>
            <label className="form-label">Categoria *</label>
            <div className="flex gap-2">
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className={cn(
                      'input-field min-w-0 flex-1',
                      errors.categoryId && 'border-red-400 focus:ring-red-200'
                    )}
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
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 text-primary-600 transition hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-400 dark:hover:bg-primary-900/50"
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
          <Input label="Fabricante" {...register('manufacturer')} />
          <Input label="Unidade" {...register('unit')} />
          <Input label="Qtd. Mínima" type="number" {...register('minQuantity')} />
          <Input label="Localização" {...register('location')} />
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
  </>
  );
}
