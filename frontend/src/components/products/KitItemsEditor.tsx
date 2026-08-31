import { useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { ProductSearchSelect, type ProductOption } from '@/components/products/ProductSearchSelect';
import { useProductBatches } from '@/hooks/queries/useProductBatches';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatProductName } from '@/utils/format';

export interface KitItemDraft {
  key: string;
  componentProductId: string;
  product?: ProductOption;
  quantity: number;
  batchId: string;
  requiresBatch?: boolean;
}

interface KitItemsEditorProps {
  items: KitItemDraft[];
  onChange: (items: KitItemDraft[]) => void;
  errors?: string;
}

function KitItemRow({
  item,
  usedBatchIds,
  repeatedProduct,
  onUpdate,
  onRemove,
}: {
  item: KitItemDraft;
  usedBatchIds: string[];
  repeatedProduct: boolean;
  onUpdate: (patch: Partial<KitItemDraft>) => void;
  onRemove: () => void;
}) {
  const { data: batchData, isLoading } = useProductBatches(item.componentProductId || undefined);
  const hasLots = batchData?.hasLots ?? false;

  useEffect(() => {
    if (!item.componentProductId || isLoading || !batchData) return;
    if (item.requiresBatch !== hasLots) {
      onUpdate({ requiresBatch: hasLots });
    }
    // onUpdate é estável o suficiente via closure do map; evita loop por referência
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.componentProductId, item.requiresBatch, hasLots, isLoading, batchData]);

  return (
    <div className="space-y-3 rounded-lg border border-teal-200/80 bg-teal-50/40 p-3 dark:border-teal-800 dark:bg-teal-950/20">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <ProductSearchSelect
            value={item.componentProductId}
            label="Produto do kit"
            required
            excludeKits
            allowCreate={false}
            onChange={(id, product) => {
              onUpdate({
                componentProductId: id,
                product,
                batchId: '',
                requiresBatch: undefined,
              });
            }}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-7 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          title="Remover item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Quantidade *"
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: Math.max(1, Number(e.target.value) || 1) })}
        />
        {item.componentProductId && (
          <div>
            <label className="form-label">
              {hasLots ? 'Lote *' : 'Lote'}
            </label>
            {isLoading ? (
              <p className="text-xs text-slate-500">Carregando lotes...</p>
            ) : hasLots ? (
              <select
                className="input-field w-full"
                value={item.batchId}
                onChange={(e) => onUpdate({ batchId: e.target.value })}
                required
              >
                <option value="">Selecione o lote *</option>
                {batchData?.batches.map((b) => (
                  <option key={b.id} value={b.id} disabled={usedBatchIds.includes(b.id)}>
                    {b.batchNumber}
                    {b.expirationDate
                      ? ` · val. ${new Date(b.expirationDate).toLocaleDateString('pt-BR')}`
                      : ''}
                    {b.location ? ` · ${b.location.name}` : ''}
                    {` (${b.quantity} un.)`}
                    {usedBatchIds.includes(b.id) ? ' — já no kit' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-600">
                Este produto não possui lotes — seleção dispensada
              </p>
            )}
          </div>
        )}
      </div>
      {repeatedProduct && hasLots && (
        <p className="text-xs text-teal-700 dark:text-teal-300">
          Este produto já está no kit — selecione um lote diferente.
        </p>
      )}
      {item.product && (
        <p className="text-xs text-slate-500">
          {formatProductName(item.product.name)} · {item.product.internalCode}
        </p>
      )}
    </div>
  );
}

export function KitItemsEditor({ items, onChange, errors }: KitItemsEditorProps) {
  const addItem = () => {
    onChange([
      ...items,
      {
        key: crypto.randomUUID(),
        componentProductId: '',
        quantity: 1,
        batchId: '',
      },
    ]);
  };

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Produtos do kit *
          </h3>
          <p className="text-xs text-slate-500">
            Mínimo de 2 itens. O mesmo produto pode entrar mais de uma vez, desde que o lote seja
            diferente.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {items.map((item) => (
        <KitItemRow
          key={item.key}
          item={item}
          usedBatchIds={items
            .filter(
              (i) =>
                i.key !== item.key &&
                i.componentProductId === item.componentProductId &&
                i.batchId
            )
            .map((i) => i.batchId)}
          repeatedProduct={
            !!item.componentProductId &&
            items.some(
              (i) => i.key !== item.key && i.componentProductId === item.componentProductId
            )
          }
          onRemove={() => onChange(items.filter((i) => i.key !== item.key))}
          onUpdate={(patch) =>
            onChange(items.map((i) => (i.key === item.key ? { ...i, ...patch } : i)))
          }
        />
      ))}

      {errors && <p className="text-xs text-red-600">{errors}</p>}
    </div>
  );
}

export function emptyKitItems(): KitItemDraft[] {
  return [
    { key: crypto.randomUUID(), componentProductId: '', quantity: 1, batchId: '' },
    { key: crypto.randomUUID(), componentProductId: '', quantity: 1, batchId: '' },
  ];
}
