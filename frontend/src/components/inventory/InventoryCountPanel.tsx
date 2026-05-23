import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ClipboardList, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import { formatDateTime, formatProductName } from '@/utils/format';
import { fuzzyScore } from '@/utils/search';

interface CatalogProduct {
  id: string;
  name: string;
  internalCode: string;
  barcode?: string | null;
}

interface InventoryItemRow {
  id: string;
  productId: string;
  batchId: string | null;
  systemQuantity: number;
  countedQuantity: number;
  divergence: number;
  adjusted: boolean;
  product: { id: string; name: string; internalCode: string };
}

interface InventoryDetail {
  id: string;
  status: string;
  startedAt: string;
  notes?: string | null;
  location: { id: string; name: string; code: string };
  user: { name: string };
  items: InventoryItemRow[];
}

interface InventoryCountPanelProps {
  inventoryId: string;
  onBack: () => void;
  onCompleted: () => void;
}

function divergenceVariant(d: number): 'success' | 'warning' | 'danger' | 'default' {
  if (d === 0) return 'success';
  if (d > 0) return 'warning';
  return 'danger';
}

function divergenceLabel(d: number): string {
  if (d === 0) return 'OK';
  return d > 0 ? `+${d}` : String(d);
}

export function InventoryCountPanel({ inventoryId, onBack, onCompleted }: InventoryCountPanelProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', inventoryId],
    queryFn: () =>
      api
        .get<{ success: boolean; data: InventoryDetail }>(`/inventory/${inventoryId}`)
        .then((r) => r.data.data),
  });

  const updateItem = useMutation({
    mutationFn: ({
      productId,
      countedQuantity,
      batchId,
    }: {
      productId: string;
      countedQuantity: number;
      batchId?: string | null;
    }) =>
      api.put(`/inventory/${inventoryId}/items`, {
        productId,
        countedQuantity,
        ...(batchId ? { batchId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', inventoryId] });
    },
    onError: () => toast.error('Erro ao salvar contagem'),
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/inventory/${inventoryId}/complete`, { autoAdjust: true }),
    onSuccess: () => {
      toast.success('Inventário concluído e estoque ajustado');
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
      onCompleted();
    },
    onError: () => toast.error('Erro ao concluir inventário'),
  });

  const searchTrim = search.trim();
  const inventoryProductIds = useMemo(
    () => new Set((inventory?.items ?? []).map((i) => i.productId)),
    [inventory?.items]
  );

  const { data: catalogProducts = [], isFetching: catalogLoading } = useQuery({
    queryKey: ['products-inventory-search', searchTrim],
    queryFn: () =>
      api
        .get('/products', { params: { search: searchTrim, limit: 50, active: true } })
        .then((r) => r.data.data as CatalogProduct[]),
    enabled: searchTrim.length >= 2 && inventory?.status === 'EM_ANDAMENTO',
  });

  const filteredItems = useMemo(() => {
    if (!inventory?.items) return [];
    if (!searchTrim) return inventory.items;
    return [...inventory.items]
      .map((item) => ({
        item,
        score: fuzzyScore(searchTrim, [
          item.product.name,
          item.product.internalCode,
        ]),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }, [inventory?.items, searchTrim]);

  const catalogToAdd = useMemo(() => {
    if (!searchTrim || searchTrim.length < 2) return [];
    return [...catalogProducts]
      .filter((p) => !inventoryProductIds.has(p.id))
      .map((p) => ({
        p,
        score: fuzzyScore(searchTrim, [p.name, p.internalCode, p.barcode]),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p)
      .slice(0, 15);
  }, [catalogProducts, inventoryProductIds, searchTrim]);

  const stats = useMemo(() => {
    const items = inventory?.items ?? [];
    const withDivergence = items.filter((i) => i.divergence !== 0).length;
    const surplus = items.filter((i) => i.divergence > 0).length;
    const shortage = items.filter((i) => i.divergence < 0).length;
    return { total: items.length, withDivergence, surplus, shortage };
  }, [inventory?.items]);

  const handleAddProduct = async (product: CatalogProduct) => {
    try {
      await updateItem.mutateAsync({ productId: product.id, countedQuantity: 0 });
      toast.success(`${formatProductName(product.name)} adicionado à contagem`);
    } catch {
      /* toast no updateItem */
    }
  };

  const handleSaveCount = async (item: InventoryItemRow, raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error('Informe uma quantidade válida (0 ou mais)');
      return;
    }
    if (parsed === item.countedQuantity) return;

    setSavingId(item.id);
    try {
      await updateItem.mutateAsync({
        productId: item.productId,
        countedQuantity: parsed,
        batchId: item.batchId,
      });
    } finally {
      setSavingId(null);
    }
  };

  const readOnly = inventory?.status !== 'EM_ANDAMENTO';

  if (isLoading || !inventory) {
    return (
      <div className="card py-12 text-center text-sm text-slate-500">Carregando contagem...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar à lista
        </Button>
        {!readOnly && (
          <Button
            onClick={() => completeMutation.mutate()}
            loading={completeMutation.isPending}
            disabled={stats.total === 0}
          >
            <CheckCircle2 className="h-4 w-4" />
            Concluir inventário
          </Button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Contagem — {inventory.location.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {inventory.location.code} · Responsável: {inventory.user.name} · Início:{' '}
              {formatDateTime(inventory.startedAt)}
            </p>
          </div>
          <Badge variant={readOnly ? 'success' : 'warning'}>
            {inventory.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card py-3 text-center">
          <p className="text-xs font-medium text-slate-500">Itens</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-xs font-medium text-slate-500">Com divergência</p>
          <p className="text-2xl font-bold text-amber-600">{stats.withDivergence}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-xs font-medium text-slate-500">Sobra</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.surplus}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-xs font-medium text-slate-500">Falta</p>
          <p className="text-2xl font-bold text-red-600">{stats.shortage}</p>
        </div>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Busca aproximada: nome, código ou código de barras..."
          className="input-field pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!readOnly && searchTrim.length >= 2 && (
        <div className="card border-primary-200 bg-primary-50/40 dark:border-primary-900 dark:bg-primary-950/30">
          <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            Adicionar à contagem
            {catalogLoading && <span className="ml-2 text-slate-500">(buscando...)</span>}
          </p>
          {catalogToAdd.length === 0 && !catalogLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nenhum produto novo encontrado para &quot;{searchTrim}&quot;.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {catalogToAdd.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{p.name}</p>
                    <p className="text-xs font-mono text-slate-500">{p.internalCode}</p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleAddProduct(p)}>
                    <Plus className="h-3.5 w-3.5" />
                    Incluir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="table-container">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left sm:px-4">Produto</th>
              <th className="px-3 py-2.5 text-right sm:px-4">Sistema</th>
              <th className="px-3 py-2.5 text-right sm:px-4">Contada</th>
              <th className="px-3 py-2.5 text-right sm:px-4">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {searchTrim
                    ? `Nenhum item na lista corresponde a "${searchTrim}".`
                    : stats.total === 0
                      ? 'Lista vazia — use a busca acima para incluir produtos.'
                      : 'Nenhum item na lista.'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <CountRow
                  key={item.id}
                  item={item}
                  readOnly={readOnly}
                  saving={savingId === item.id}
                  onSave={handleSaveCount}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && stats.withDivergence > 0 && (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Ao concluir, {stats.withDivergence} item(ns) com divergência gerarão ajuste automático no
          estoque e movimentações de entrada/saída.
        </p>
      )}
    </div>
  );
}

function CountRow({
  item,
  readOnly,
  saving,
  onSave,
}: {
  item: InventoryItemRow;
  readOnly: boolean;
  saving: boolean;
  onSave: (item: InventoryItemRow, raw: string) => void;
}) {
  const [local, setLocal] = useState(String(item.countedQuantity));

  useEffect(() => {
    setLocal(String(item.countedQuantity));
  }, [item.countedQuantity, item.id]);

  const displayDivergence =
    readOnly || local === '' || Number.isNaN(parseInt(local, 10))
      ? item.divergence
      : parseInt(local, 10) - item.systemQuantity;

  return (
    <tr
      className={cn(
        item.divergence !== 0 && readOnly && 'bg-amber-50/50 dark:bg-amber-950/20',
        !readOnly && displayDivergence !== 0 && 'bg-amber-50/30'
      )}
    >
      <td className="px-3 py-2 sm:px-4">
        <p className="font-medium text-slate-900 dark:text-slate-100">{formatProductName(item.product.name)}</p>
        <p className="text-xs text-slate-500 font-mono">{item.product.internalCode}</p>
      </td>
      <td className="px-3 py-2 text-right font-medium tabular-nums sm:px-4">{item.systemQuantity}</td>
      <td className="px-3 py-2 text-right sm:px-4">
        {readOnly ? (
          <span className="font-medium tabular-nums">{item.countedQuantity}</span>
        ) : (
          <input
            type="number"
            min={0}
            step={1}
            value={local}
            disabled={saving}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onSave(item, local)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className={cn(
              'input-field w-24 text-right tabular-nums',
              saving && 'opacity-60'
            )}
            aria-label={`Quantidade contada de ${formatProductName(item.product.name)}`}
          />
        )}
      </td>
      <td className="px-3 py-2 text-right sm:px-4">
        <Badge variant={divergenceVariant(displayDivergence)}>
          {divergenceLabel(displayDivergence)}
        </Badge>
      </td>
    </tr>
  );
}
