import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { InventoryCountPanel } from '@/components/inventory/InventoryCountPanel';
import { formatDateTime } from '@/utils/format';
import { useLocations } from '@/hooks/queries/useLocations';

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
  const [countingId, setCountingId] = useState<string | null>(null);

  const { data: locations } = useLocations();

  const { data, isLoading } = useQuery({
    queryKey: ['inventories'],
    queryFn: () => api.get('/inventory', { params: { limit: 50 } }).then((r) => r.data),
    enabled: !countingId,
  });

  const createMutation = useMutation({
    mutationFn: (locationId: string) => api.post('/inventory', { locationId }),
    onSuccess: (res) => {
      toast.success('Inventário iniciado — informe as contagens');
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
      const id = res.data?.data?.id;
      if (id) setCountingId(id);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Erro ao iniciar inventário');
    },
  });

  const statusVariant: Record<string, 'warning' | 'success' | 'danger'> = {
    EM_ANDAMENTO: 'warning',
    CONCLUIDO: 'success',
    CANCELADO: 'danger',
  };

  if (countingId) {
    return (
      <div className="page-content">
        <PageHeader title="Contagem de inventário" />
        <InventoryCountPanel
          inventoryId={countingId}
          onBack={() => setCountingId(null)}
          onCompleted={() => setCountingId(null)}
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader title="Inventário" />

      <div className="card">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          Inicie um inventário por local. Depois informe a quantidade contada de cada produto antes de
          concluir.
        </p>
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
      </div>

      <DataTable<InventoryRecord>
        loading={isLoading}
        data={data?.data || []}
        emptyIcon={ClipboardList}
        emptyTitle="Nenhum inventário registrado"
        onRowClick={(i) => setCountingId(i.id)}
        columns={[
          { key: 'location', header: 'Local', render: (i) => i.location.name },
          {
            key: 'status',
            header: 'Status',
            render: (i) => (
              <Badge variant={statusVariant[i.status]}>{i.status.replace(/_/g, ' ')}</Badge>
            ),
          },
          { key: 'user', header: 'Responsável', render: (i) => i.user.name },
          { key: 'started', header: 'Início', render: (i) => formatDateTime(i.startedAt) },
          { key: 'items', header: 'Itens', render: (i) => i._count?.items ?? 0 },
        ]}
      />
    </div>
  );
}
