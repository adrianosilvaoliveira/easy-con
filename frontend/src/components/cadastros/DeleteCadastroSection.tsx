import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface DeleteCadastroSectionProps {
  title: string;
  entityLabel: string;
  canDelete: boolean;
  reasons: string[];
  okMessage: string;
  loading?: boolean;
  checking?: boolean;
  onDelete: () => void;
}

export function DeleteCadastroSection({
  title,
  entityLabel,
  canDelete,
  reasons,
  okMessage,
  loading,
  checking,
  onDelete,
}: DeleteCadastroSectionProps) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-950/30 sm:col-span-2">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
      {canDelete ? (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{okMessage}</p>
      ) : (
        <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
          {(checking ? ['Verificando...'] : reasons).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="danger"
        size="sm"
        className="mt-2"
        disabled={!canDelete || loading || checking}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
        Excluir {entityLabel}
      </Button>
    </div>
  );
}
