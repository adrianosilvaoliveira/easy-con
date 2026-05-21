import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ActiveToggleField } from '@/components/ui/ActiveToggleField';

export const supplierSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  cnpj: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export type SupplierFormData = z.infer<typeof supplierSchema>;

export interface CreatedSupplier {
  id: string;
  name: string;
  cnpj?: string | null;
}

interface SupplierFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (supplier: CreatedSupplier) => void;
  initialName?: string;
  supplierId?: string | null;
}

export function SupplierFormModal({
  open,
  onClose,
  onSuccess,
  initialName = '',
  supplierId = null,
}: SupplierFormModalProps) {
  const isEdit = !!supplierId;
  const queryClient = useQueryClient();
  const [active, setActive] = useState(true);

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: () => api.get(`/suppliers/${supplierId}`).then((r) => r.data.data),
    enabled: open && !!supplierId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  });

  useEffect(() => {
    if (!open) return;
    if (supplier && isEdit) {
      reset({
        name: supplier.name,
        cnpj: supplier.cnpj || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
      });
      setActive(supplier.active ?? true);
    } else if (!isEdit) {
      reset({ name: initialName, cnpj: '', email: '', phone: '', address: '' });
      setActive(true);
    }
  }, [open, supplier, isEdit, initialName, reset]);

  const createMutation = useMutation({
    mutationFn: (data: SupplierFormData) => api.post('/suppliers', data),
    onSuccess: (res) => {
      toast.success('Fornecedor cadastrado');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-search'] });
      onSuccess?.(res.data.data);
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao salvar'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: SupplierFormData & { active: boolean }) =>
      api.put(`/suppliers/${supplierId}`, data),
    onSuccess: (res) => {
      toast.success('Fornecedor atualizado');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] });
      onSuccess?.(res.data.data);
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao atualizar'),
  });

  const onSubmit = (data: SupplierFormData) => {
    if (isEdit) updateMutation.mutate({ ...data, active });
    else createMutation.mutate(data);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      size="lg"
    >
      {isLoading && isEdit ? (
        <p className="py-8 text-center text-slate-500">Carregando...</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome *" error={errors.name?.message} {...register('name')} />
          <Input label="CNPJ" {...register('cnpj')} />
          <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Telefone" {...register('phone')} />
          <Input label="Endereço" className="sm:col-span-2" {...register('address')} />
          {isEdit && <ActiveToggleField active={active} onChange={setActive} />}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {isEdit ? 'Salvar alterações' : 'Salvar fornecedor'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
