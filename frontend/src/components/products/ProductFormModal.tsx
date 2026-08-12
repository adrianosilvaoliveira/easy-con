import { useEffect, useMemo, useState } from 'react';
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
import { ProductTypeSelect, type RegistrationKind } from '@/components/products/ProductTypeSelect';
import { KitItemsEditor, emptyKitItems, type KitItemDraft } from '@/components/products/KitItemsEditor';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';
import { getApiErrorMessage } from '@/utils/apiError';
import { queryKeys } from '@/lib/queryKeys';
import type { Product } from '@/types';

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
  productType?: RegistrationKind;
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
  const [active, setActive] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [registrationKind, setRegistrationKind] = useState<RegistrationKind | null>(null);
  const [kitItems, setKitItems] = useState<KitItemDraft[]>(emptyKitItems);
  const [kitItemsError, setKitItemsError] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/products/categories').then((r) => r.data.data),
    enabled: open,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () =>
      api
        .get('/suppliers', { params: { includeInactive: 'false', limit: 200 } })
        .then((r) => r.data.data),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.get(`/products/${productId}`).then((r) => r.data.data as Product),
    enabled: open && !!productId,
  });

  const isKit = registrationKind === 'KIT';
  const showTypeSelect = open && !isEdit && !registrationKind;
  const showForm = open && (isEdit ? !loadingProduct && !!registrationKind : !!registrationKind);

  const stockLocationLabel = useMemo(() => {
    const items = product?.stockItems as { quantity: number; location: { name: string } }[] | undefined;
    if (!items?.length) return '';
    return items
      .filter((i) => i.quantity > 0)
      .map((i) => `${i.location.name} (${i.quantity} un.)`)
      .join(' · ');
  }, [product]);

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
    if (!open) {
      setRegistrationKind(null);
      setKitItems(emptyKitItems());
      setKitItemsError('');
      return;
    }
    if (product && isEdit) {
      const kind = (product.productType as RegistrationKind) || 'PRODUCT';
      setRegistrationKind(kind);
      reset({
        name: formatProductName(product.name),
        internalCode: product.internalCode,
        barcode: product.barcode || '',
        categoryId: product.categoryId || product.category?.id || '',
        manufacturer: product.manufacturer || '',
        unit: product.unit || (kind === 'KIT' ? 'KIT' : 'UN'),
        minQuantity: product.minQuantity,
        notes: product.notes || '',
      });
      setActive(product.active ?? true);
      if (kind === 'KIT' && product.kitItems?.length) {
        setKitItems(
          product.kitItems.map((ki) => ({
            key: ki.id,
            componentProductId: ki.componentProductId || ki.componentProduct.id,
            product: {
              id: ki.componentProduct.id,
              name: ki.componentProduct.name,
              internalCode: ki.componentProduct.internalCode,
              barcode: ki.componentProduct.barcode,
            },
            quantity: ki.quantity,
            batchId: ki.batchId || ki.batch?.id || '',
          }))
        );
      }
      return;
    }
    if (!isEdit && registrationKind) {
      reset({
        unit: registrationKind === 'KIT' ? 'KIT' : 'UN',
        minQuantity: 0,
        name: formatProductNameInput(initialName),
      });
      setActive(true);
      if (registrationKind === 'KIT') {
        setKitItems(emptyKitItems());
      }
    }
  }, [open, product, isEdit, initialName, reset, registrationKind]);

  const invalidateProductQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['products-list'] });
    queryClient.invalidateQueries({ queryKey: ['products-search'] });
    queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.stockLocations });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    if (productId) {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/products', data),
    onSuccess: (res) => {
      const p = res.data.data as CreatedProduct;
      toast.success(
        isKit
          ? `Kit cadastrado — código ${p.internalCode}`
          : `Produto cadastrado — código ${p.internalCode}`
      );
      invalidateProductQueries();
      onSuccess?.(p);
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Erro ao salvar')),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/products/${productId}`, data),
    onSuccess: (res) => {
      toast.success(isKit ? 'Kit atualizado' : 'Produto atualizado');
      invalidateProductQueries();
      onSuccess?.(res.data.data);
      onClose();
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Erro ao atualizar')),
  });

  const validateKitDraft = (): boolean => {
    const filled = kitItems.filter((i) => i.componentProductId);
    if (filled.length < 2) {
      setKitItemsError('Inclua pelo menos dois produtos no kit');
      return false;
    }
    for (const item of filled) {
      if (!item.quantity || item.quantity < 1) {
        setKitItemsError('Informe a quantidade de cada item');
        return false;
      }
    }
    setKitItemsError('');
    return true;
  };

  const onSubmit = (data: ProductFormData) => {
    const { location: _location, ...rest } = data;
    const trimmedCode = rest.internalCode?.trim();
    if (isEdit && !trimmedCode) {
      toast.error('Código interno obrigatório');
      return;
    }

    if (isKit) {
      if (!validateKitDraft()) return;
    }

    const payload: Record<string, unknown> = {
      ...rest,
      name: formatProductName(rest.name),
      productType: registrationKind || 'PRODUCT',
      ...(trimmedCode ? { internalCode: trimmedCode } : {}),
    };

    if (isKit) {
      payload.kitItems = kitItems
        .filter((i) => i.componentProductId)
        .map((i) => ({
          componentProductId: i.componentProductId,
          quantity: i.quantity,
          batchId: i.batchId || null,
        }));
      payload.unit = rest.unit || 'KIT';
      delete payload.barcode; // gerado no backend
    }

    if (isEdit) {
      updateMutation.mutate({ ...payload, active, internalCode: trimmedCode! });
    } else {
      createMutation.mutate(payload);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  const modalTitle = showTypeSelect
    ? 'Novo cadastro'
    : isEdit
      ? isKit
        ? 'Editar Kit'
        : 'Editar Produto'
      : isKit
        ? 'Novo Kit'
        : 'Novo Produto';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={modalTitle}
        size="xl"
        footer={
          showForm ? (
            <div className="flex justify-end gap-2">
              {!isEdit && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setRegistrationKind(null);
                    setKitItems(emptyKitItems());
                  }}
                >
                  Voltar
                </Button>
              )}
              <Button variant="secondary" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" form="product-form" loading={pending}>
                {isEdit ? 'Salvar alterações' : isKit ? 'Salvar kit' : 'Salvar produto'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {showTypeSelect && <ProductTypeSelect onSelect={setRegistrationKind} />}

        {isEdit && (loadingProduct || !registrationKind) && (
          <p className="py-8 text-center text-slate-500">Carregando...</p>
        )}

        {showForm && (
          <form
            id="product-form"
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-4 sm:grid-cols-2"
          >
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
            {isKit ? (
              <div>
                <label className="form-label">Código de Barras (EAN-13)</label>
                <p className="rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 font-mono text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100">
                  {isEdit && product?.barcode
                    ? product.barcode
                    : 'Gerado automaticamente ao salvar'}
                </p>
              </div>
            ) : (
              <Input label="Código de Barras" {...register('barcode')} />
            )}
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

            {!isKit && (
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
            )}

            <Input label="Unidade" {...register('unit')} />
            {!isKit && <Input label="Qtd. Mínima" type="number" {...register('minQuantity')} />}

            {isEdit && !isKit && (
              <div>
                <label className="form-label">Localização em estoque</label>
                <p className="rounded-lg border border-surface-border bg-slate-50/60 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                  {stockLocationLabel || 'Sem saldo em estoque'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Para alterar o local, use Transferências.
                </p>
              </div>
            )}

            {isKit && (
              <>
                <KitItemsEditor items={kitItems} onChange={setKitItems} errors={kitItemsError} />
                <p className="sm:col-span-2 text-xs text-slate-500">
                  O cadastro define a receita. Para gerar estoque do kit, use Estoque → Montar kit.
                </p>
              </>
            )}

            <div className="sm:col-span-2">
              <Input label="Observações" {...register('notes')} />
            </div>
            {isEdit && <ActiveToggleField active={active} onChange={setActive} />}
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
    </>
  );
}
