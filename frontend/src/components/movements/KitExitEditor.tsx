import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ProductSearchSelect, type ProductOption } from '@/components/products/ProductSearchSelect';
import { KitBadge } from '@/components/products/ProductTypeSelect';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAvailableLots } from '@/hooks/queries/useAvailableLots';
import { formatDate, formatProductName } from '@/utils/format';
import type { Product, ProductKitItem } from '@/types';
import { cn } from '@/utils/cn';

export type KitExitLine = {
  key: string;
  componentProductId: string;
  name: string;
  internalCode?: string;
  /** Quantidade por kit (será multiplicada pela qtd de kits no submit). */
  quantityPerKit: number;
  batchId: string;
  preferredBatchId?: string;
  /** true quando há lotes no local selecionado */
  hasLots?: boolean;
};

type KitExitEditorProps = {
  kitDetail?: Product;
  locationId?: string;
  kitQuantity: number;
  lines: KitExitLine[];
  onChange: (lines: KitExitLine[]) => void;
  error?: string;
};

function ComponentLotSelect({
  productId,
  locationId,
  value,
  preferredBatchId,
  onChange,
  onLotsResolved,
  required,
}: {
  productId: string;
  locationId?: string;
  value: string;
  preferredBatchId?: string;
  onChange: (batchId: string) => void;
  onLotsResolved?: (hasLots: boolean) => void;
  required: boolean;
}) {
  const { lots, hasLots, isLoading } = useAvailableLots(productId, locationId, !!productId && !!locationId);

  useEffect(() => {
    if (!locationId || isLoading) return;
    onLotsResolved?.(hasLots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLots, isLoading, locationId]);

  useEffect(() => {
    if (!hasLots || isLoading) return;
    if (value) return;
    if (preferredBatchId && lots.some((l) => l.batchId === preferredBatchId)) {
      onChange(preferredBatchId);
      return;
    }
    if (lots.length === 1) {
      onChange(lots[0].batchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLots, isLoading, lots, value, preferredBatchId]);

  if (!locationId) {
    return <p className="text-xs text-slate-500">Selecione o local primeiro</p>;
  }
  if (isLoading) {
    return <p className="text-xs text-slate-500">Carregando lotes...</p>;
  }
  if (!hasLots) {
    return (
      <p className="rounded border border-dashed border-slate-200 px-2 py-1.5 text-xs text-slate-500 dark:border-slate-600">
        Sem lotes neste local
      </p>
    );
  }

  return (
    <select
      className={cn('input-field w-full text-sm', required && !value && 'border-amber-400')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">
        {lots.length > 1 ? 'Selecione o lote *' : 'Selecione o lote...'}
      </option>
      {lots.map((lot) => (
        <option key={lot.batchId} value={lot.batchId}>
          {lot.batchNumber}
          {lot.expirationDate ? ` — Val. ${formatDate(lot.expirationDate)}` : ''}
          {` (${lot.quantity} un.)`}
        </option>
      ))}
    </select>
  );
}

function lineFromKitItem(ki: ProductKitItem): KitExitLine {
  return {
    key: ki.id,
    componentProductId: ki.componentProductId || ki.componentProduct.id,
    name: ki.componentProduct.name,
    internalCode: ki.componentProduct.internalCode,
    quantityPerKit: ki.quantity,
    batchId: ki.batchId || ki.batch?.id || '',
    preferredBatchId: ki.batchId || ki.batch?.id || undefined,
  };
}

export function KitExitEditor({
  kitDetail,
  locationId,
  kitQuantity,
  lines,
  onChange,
  error,
}: KitExitEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newProductId, setNewProductId] = useState('');

      // Remove auto-init interno do editor (pai controla via resetKitLinesFromDetail)

  const usedIds = useMemo(
    () => new Set(lines.map((l) => l.componentProductId).filter(Boolean)),
    [lines]
  );

  const updateLine = (key: string, patch: Partial<KitExitLine>) => {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    onChange(lines.filter((l) => l.key !== key));
  };

  const addProduct = (id: string, product?: ProductOption) => {
    if (!id || !product) return;
    if (usedIds.has(id)) return;
    if (product.productType === 'KIT') return;
    onChange([
      ...lines,
      {
        key: crypto.randomUUID(),
        componentProductId: id,
        name: product.name,
        internalCode: product.internalCode,
        quantityPerKit: 1,
        batchId: '',
      },
    ]);
    setNewProductId('');
    setAdding(false);
  };

  const qtyKits = Math.max(1, kitQuantity || 1);

  return (
    <div className="sm:col-span-2 space-y-3 rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-3 text-sm dark:border-teal-800 dark:bg-teal-950/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-medium text-teal-900 dark:text-teal-100">
            <KitBadge /> Editar composição desta saída
          </p>
          <p className="mt-1 text-xs text-teal-800 dark:text-teal-200">
            Inclua ou remova produtos. Se houver mais de um lote no local, escolha qual usar.
            A quantidade por produto é multiplicada pela quantidade de kits ({qtyKits}).
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Incluir produto
        </Button>
      </div>

      {adding && (
        <div className="rounded-lg border border-teal-200 bg-white p-3 dark:border-teal-800 dark:bg-slate-900/40">
          <ProductSearchSelect
            value={newProductId}
            label="Produto a incluir"
            excludeKits
            allowCreate={false}
            onChange={addProduct}
          />
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!kitDetail?.kitItems && lines.length === 0 ? (
        <p className="text-xs text-slate-500">Carregando composição...</p>
      ) : lines.length === 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Nenhum produto na saída. Inclua ao menos um.
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line) => (
            <li
              key={line.key}
              className="grid gap-2 rounded-lg border border-teal-100 bg-white/80 p-3 dark:border-teal-900 dark:bg-slate-900/50 sm:grid-cols-[1fr_5.5rem_minmax(10rem,1fr)_auto]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {formatProductName(line.name)}
                </p>
                {line.internalCode && (
                  <p className="font-mono text-xs text-slate-500">{line.internalCode}</p>
                )}
                <p className="text-[11px] text-slate-400">
                  Total baixa: {line.quantityPerKit * qtyKits} un.
                </p>
              </div>
              <Input
                label="Qtd/kit"
                type="number"
                min={1}
                value={line.quantityPerKit}
                onChange={(e) =>
                  updateLine(line.key, {
                    quantityPerKit: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
              <div>
                <label className="form-label">Lote</label>
                <ComponentLotSelect
                  productId={line.componentProductId}
                  locationId={locationId}
                  value={line.batchId}
                  preferredBatchId={line.preferredBatchId}
                  required={!!line.hasLots}
                  onChange={(batchId) => updateLine(line.key, { batchId })}
                  onLotsResolved={(hasLots) => {
                    if (line.hasLots !== hasLots) {
                      updateLine(line.key, { hasLots, ...(hasLots ? {} : { batchId: '' }) });
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                className="mt-6 self-start rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                title="Remover da saída"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function resetKitLinesFromDetail(kitDetail?: Product): KitExitLine[] {
  if (!kitDetail?.kitItems?.length) return [];
  return kitDetail.kitItems.map(lineFromKitItem);
}
