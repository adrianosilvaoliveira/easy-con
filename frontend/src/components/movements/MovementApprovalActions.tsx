import { useState } from 'react';
import { Check, X, Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/Badge';
import { movementStatusLabel } from '@/utils/format';
import type { StockMovement } from '@/types';
import { MovementDetailsModal } from './MovementDetailsModal';

export const movementStatusVariant: Record<string, 'warning' | 'success' | 'danger' | 'info' | 'default'> = {
  PENDENTE: 'warning',
  APROVADA: 'success',
  REJEITADA: 'danger',
  CONCLUIDA: 'info',
};

export function MovementStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={movementStatusVariant[status] || 'default'}>
      {movementStatusLabel(status)}
    </Badge>
  );
}

/** Hook compartilhado para aprovar/rejeitar uma movimentação. */
export function useApproveMovement(movementId: string, invalidateKeys: string[] = []) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ approved }: { approved: boolean }) =>
      api.patch(`/movements/${movementId}/approve`, { approved }),
    onSuccess: (_, { approved }) => {
      toast.success(approved ? 'Movimentação aprovada e efetivada' : 'Movimentação rejeitada');
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao processar movimentação'),
  });
}

interface MovementApprovalActionsProps {
  movement: StockMovement;
  invalidateKeys?: string[];
}

export function MovementApprovalActions({
  movement,
  invalidateKeys = [],
}: MovementApprovalActionsProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const approveMutation = useApproveMovement(movement.id, invalidateKeys);

  const canApprove = movement.status === 'PENDENTE' && hasPermission('movements:APPROVE');

  return (
    <>
      <div className="flex gap-1">
        <button
          type="button"
          title="Ver detalhes"
          onClick={() => setDetailsOpen(true)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <Eye className="h-4 w-4" />
        </button>
        {canApprove && (
          <>
            <button
              type="button"
              title="Aprovar"
              onClick={() => approveMutation.mutate({ approved: true })}
              disabled={approveMutation.isPending}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Rejeitar"
              onClick={() => approveMutation.mutate({ approved: false })}
              disabled={approveMutation.isPending}
              className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <MovementDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        movement={movement}
        invalidateKeys={invalidateKeys}
      />
    </>
  );
}
