import { useEffect, useState } from 'react';
import { Package, Boxes } from 'lucide-react';
import { cn } from '@/utils/cn';

export type RegistrationKind = 'PRODUCT' | 'KIT';

interface ProductTypeSelectProps {
  onSelect: (kind: RegistrationKind) => void;
}

export function ProductTypeSelect({ onSelect }: ProductTypeSelectProps) {
  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        O que deseja cadastrar?
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect('PRODUCT')}
          className={cn(
            'flex flex-col items-start gap-2 rounded-xl border-2 border-surface-border p-4 text-left transition',
            'hover:border-primary-400 hover:bg-primary-50/60 dark:border-slate-600 dark:hover:border-primary-500 dark:hover:bg-primary-950/40'
          )}
        >
          <Package className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">Produto</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Cadastro de um item individual no estoque
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelect('KIT')}
          className={cn(
            'flex flex-col items-start gap-2 rounded-xl border-2 border-teal-200 p-4 text-left transition',
            'hover:border-teal-400 hover:bg-teal-50/80 dark:border-teal-800 dark:hover:border-teal-500 dark:hover:bg-teal-950/40'
          )}
        >
          <Boxes className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">Kit</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Conjunto de dois ou mais produtos — informe o lote de cada item
          </span>
        </button>
      </div>
    </div>
  );
}

/** Destaque visual para kits em listas e buscas */
export function kitRowClassName(isKit?: boolean) {
  if (!isKit) return undefined;
  return 'bg-teal-50/80 text-teal-950 dark:bg-teal-950/35 dark:text-teal-100';
}

export function KitBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
        className
      )}
    >
      Kit
    </span>
  );
}

/** Reseta seleção de tipo ao fechar o modal */
export function useRegistrationKind(
  open: boolean,
  isEdit: boolean,
  productType?: RegistrationKind | null
) {
  const [kind, setKind] = useState<RegistrationKind | null>(null);

  useEffect(() => {
    if (!open) {
      setKind(null);
      return;
    }
    if (isEdit && productType) {
      setKind(productType);
    }
  }, [open, isEdit, productType]);

  return [kind, setKind] as const;
}
