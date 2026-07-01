import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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
  MovementApprovalActions,
  MovementStatusBadge,
} from '@/components/movements/MovementApprovalActions';

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
  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { params: { limit: 200 } }).then((r) => r.data.data),
  });

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

  const { register, handleSubmit, reset } = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { type: 'TRANSFERENCIA' },
  });

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
      queryClient.invalidateQueries({ queryKey: ['stock'] });
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
        columns={[
          { key: 'date', header: 'Data', render: (m) => formatDateTime(m.movementDate) },
          { key: 'product', header: 'Produto', render: (m) => formatProductName(m.product.name) },
          { key: 'origin', header: 'Origem', render: (m) => m.originLocation?.name },
          { key: 'dest', header: 'Destino', render: (m) => m.destinationLocation?.name },
          { key: 'qty', header: 'Qtd', render: (m) => m.quantity },
          { key: 'status', header: 'Status', render: (m) => <MovementStatusBadge status={m.status} /> },
          { key: 'user', header: 'Usuário', render: (m) => m.user.name },
          {
            key: 'actions',
            header: 'Ações',
            render: (m) => (
              <MovementApprovalActions
                movementId={m.id}
                status={m.status}
                invalidateKeys={['transfers']}
              />
            ),
          },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Transferência" size="lg">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="form-label">Produto</label>
            <select className="input-field" {...register('productId')}>
              <option value="">Selecione...</option>
              {products?.map((p: { id: string; name: string; internalCode: string }) => (
                <option key={p.id} value={p.id}>{p.internalCode} - {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Origem</label>
            <select className="input-field" {...register('originLocationId')}>
              <option value="">Selecione...</option>
              {locations?.map((l: { id: string; name: string }) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Destino</label>
            <select className="input-field" {...register('destinationLocationId')}>
              <option value="">Selecione...</option>
              {locations?.map((l: { id: string; name: string }) => (
                <option key={l.id} value={l.id}>{l.name}</option>
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
