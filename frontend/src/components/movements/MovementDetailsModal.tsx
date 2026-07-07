import type { ReactNode } from 'react';
import { Check, X, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import type { StockMovement } from '@/types';
import {
  formatDate,
  formatDateTime,
  formatProductName,
  movementTypeLabel,
} from '@/utils/format';
import { MovementStatusBadge, useApproveMovement, useDeleteMovement } from './MovementApprovalActions';

interface MovementDetailsModalProps {
  open: boolean;
  onClose: () => void;
  movement: StockMovement;
  invalidateKeys?: string[];
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-surface-border py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 sm:text-right">
        {value}
      </span>
    </div>
  );
}

export function MovementDetailsModal({
  open,
  onClose,
  movement,
  invalidateKeys = [],
}: MovementDetailsModalProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const approveMutation = useApproveMovement(movement.id, invalidateKeys);
  const deleteMutation = useDeleteMovement(movement.id, invalidateKeys);

  const canApprove = movement.status === 'PENDENTE' && hasPermission('movements:APPROVE');
  const canDelete = hasPermission('movements:DELETE');

  const handleApprove = (approved: boolean) => {
    approveMutation.mutate({ approved }, { onSuccess: onClose });
  };

  const handleDelete = () => {
    const reversible = movement.status === 'CONCLUIDA' || movement.status === 'APROVADA';
    const message = reversible
      ? 'Excluir esta movimentação e estornar o estoque? Esta ação não pode ser desfeita.'
      : 'Excluir esta movimentação? Esta ação não pode ser desfeita.';
    if (!window.confirm(message)) return;
    deleteMutation.mutate(undefined, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title="Detalhes da Movimentação" size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {formatProductName(movement.product.name)}
          </h3>
          <MovementStatusBadge status={movement.status} />
        </div>

        <div className="rounded-xl border border-surface-border bg-slate-50/60 px-4 py-1 dark:border-slate-700 dark:bg-slate-900/40">
          <DetailRow label="Tipo" value={movementTypeLabel(movement.type)} />
          <DetailRow label="Código do produto" value={movement.product.internalCode} />
          <DetailRow label="Quantidade" value={movement.quantity} />
          <DetailRow label="Origem" value={movement.originLocation?.name} />
          <DetailRow label="Destino" value={movement.destinationLocation?.name} />
          <DetailRow
            label="Lote"
            value={
              movement.batch
                ? `${movement.batch.batchNumber}${
                    movement.batch.expirationDate
                      ? ` (val. ${formatDate(movement.batch.expirationDate)})`
                      : ''
                  }`
                : undefined
            }
          />
          <DetailRow label="Fornecedor" value={movement.supplier?.name} />
          <DetailRow label="Nota fiscal" value={movement.invoiceNumber} />
          <DetailRow label="Data da movimentação" value={formatDateTime(movement.movementDate)} />
          <DetailRow label="Solicitado por" value={movement.user?.name} />
          <DetailRow label="Motivo" value={movement.reason} />
          <DetailRow label="Observações" value={movement.notes} />
          <DetailRow label="Aprovado/Rejeitado por" value={movement.approvedBy?.name} />
          <DetailRow
            label="Data da decisão"
            value={movement.approvedAt ? formatDateTime(movement.approvedAt) : undefined}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-surface-border pt-4 dark:border-slate-700">
          {canDelete && (
            <Button
              variant="danger"
              type="button"
              className="mr-auto"
              loading={deleteMutation.isPending}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="secondary" type="button" onClick={onClose}>
            Fechar
          </Button>
          {canApprove && (
            <>
              <Button
                variant="danger"
                type="button"
                loading={approveMutation.isPending}
                onClick={() => handleApprove(false)}
              >
                <X className="h-4 w-4" /> Rejeitar
              </Button>
              <Button
                type="button"
                loading={approveMutation.isPending}
                onClick={() => handleApprove(true)}
              >
                <Check className="h-4 w-4" /> Aprovar
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
