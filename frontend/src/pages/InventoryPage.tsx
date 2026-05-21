import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/format';

interface InventoryRecord {
  id: string;
  status: string;
  startedAt: string;
  location: { name: string };
  user: { name: string };
  _count?: { items: number };
}

export function InventoryPage() {
  const queryClient = useQueryClient();

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventories'],
    queryFn: () => api.get('/inventory', { params: { limit: 50 } }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (locationId: string) => api.post('/inventory', { locationId }),
    onSuccess: () => {
      toast.success('Inventário iniciado');
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
    },
    onError: () => toast.error('Erro ao iniciar inventário'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/inventory/${id}/complete`, { autoAdjust: true }),
    onSuccess: () => {
      toast.success('Inventário concluído com ajustes');
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
    },
  });

  const statusVariant: Record<string, 'warning' | 'success' | 'danger'> = {
    EM_ANDAMENTO: 'warning',
    CONCLUIDO: 'success',
    CANCELADO: 'danger',
  };

  return (
    <div className="page-content">
      <PageHeader title="Inventário" />
      <div className="flex flex-wrap gap-2">
          {locations?.map((l: { id: string; name: string }) => (
            <Button
              key={l.id}
              variant="secondary"
              size="sm"
              onClick={() => createMutation.mutate(l.id)}
              loading={createMutation.isPending}
            >
              <Plus className="h-3 w-3" /> {l.name}
            </Button>
          ))}
      </div>

      <DataTable<InventoryRecord>
        loading={isLoading}
        data={data?.data || []}
        emptyIcon={ClipboardList}
        emptyTitle="Nenhum inventário registrado"
        columns={[
          { key: 'location', header: 'Local', render: (i) => i.location.name },
          { key: 'status', header: 'Status', render: (i) => <Badge variant={statusVariant[i.status]}>{i.status.replace(/_/g, ' ')}</Badge> },
          { key: 'user', header: 'Responsável', render: (i) => i.user.name },
          { key: 'started', header: 'Início', render: (i) => formatDateTime(i.startedAt) },
          { key: 'items', header: 'Itens', render: (i) => i._count?.items ?? 0 },
          {
            key: 'actions',
            header: 'Ações',
            render: (i) =>
              i.status === 'EM_ANDAMENTO' ? (
                <Button size="sm" onClick={() => completeMutation.mutate(i.id)} loading={completeMutation.isPending}>
                  Concluir
                </Button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
