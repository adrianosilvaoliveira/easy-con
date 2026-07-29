import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Printer, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useDebounce } from '@/hooks/useDebounce';
import { formatProductName } from '@/utils/format';
import { printBarcodeLabels, type LabelItem } from '@/utils/printBarcodeLabels';
import { KitBadge, kitRowClassName } from '@/components/products/ProductTypeSelect';
import { cn } from '@/utils/cn';
import type { Product } from '@/types';

type SelectedLabel = LabelItem & { quantity: number };

interface PrintLabelsModalProps {
  open: boolean;
  onClose: () => void;
  /** Produtos/kits pré-selecionados (ex.: da tabela de estoque) */
  preselected?: LabelItem[];
}

function itemKey(item: Pick<LabelItem, 'barcode' | 'internalCode'>, id?: string) {
  if (id) return id;
  return `${item.internalCode ?? ''}|${item.barcode}`;
}

export function PrintLabelsModal({ open, onClose, preselected = [] }: PrintLabelsModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Map<string, SelectedLabel>>(new Map());
  const [printing, setPrinting] = useState(false);
  const debounced = useDebounce(search, 300);
  const wasOpen = useRef(false);
  const preselectedRef = useRef(preselected);
  preselectedRef.current = preselected;

  // Só monta a lista ao abrir o modal — não reseta ao buscar ou ao re-render do pai
  useEffect(() => {
    if (open && !wasOpen.current) {
      const map = new Map<string, SelectedLabel>();
      preselectedRef.current.forEach((item) => {
        if (!item.barcode?.trim()) return;
        const key = itemKey(item);
        map.set(key, {
          ...item,
          quantity: Math.max(1, item.quantity ?? 1),
        });
      });
      setSelected(map);
      setSearch('');
    }
    if (!open) {
      setSelected(new Map());
      setSearch('');
    }
    wasOpen.current = open;
  }, [open]);

  const { data: products = [], isFetching } = useQuery({
    queryKey: ['products-labels', debounced],
    queryFn: () =>
      api
        .get('/products', {
          params: { search: debounced.trim() || undefined, limit: 80 },
        })
        .then((r) => r.data.data as Product[]),
    enabled: open,
  });

  const withBarcode = products.filter((p) => p.barcode?.trim());

  const totalLabels = useMemo(
    () => Array.from(selected.values()).reduce((sum, i) => sum + i.quantity, 0),
    [selected]
  );

  const isInList = (product: Product) => {
    const key = itemKey(
      { barcode: product.barcode!, internalCode: product.internalCode },
      product.id
    );
    if (selected.has(product.id) || selected.has(key)) return true;
    for (const item of selected.values()) {
      if (item.barcode === product.barcode && item.internalCode === product.internalCode) {
        return true;
      }
    }
    return false;
  };

  const addToList = (product: Product) => {
    if (!product.barcode?.trim()) {
      toast.error('Este item não possui código de barras');
      return;
    }
    if (isInList(product)) {
      toast.message('Item já está na lista de impressão');
      return;
    }
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(product.id, {
        name: product.name,
        barcode: product.barcode!,
        internalCode: product.internalCode,
        isKit: product.productType === 'KIT',
        quantity: 1,
      });
      return next;
    });
  };

  const setQuantity = (key: string, raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const quantity = Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : 1;
    setSelected((prev) => {
      const next = new Map(prev);
      const item = next.get(key);
      if (!item) return prev;
      next.set(key, { ...item, quantity });
      return next;
    });
  };

  const removeSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const clearList = () => setSelected(new Map());

  const handlePrint = () => {
    const items = Array.from(selected.values());
    if (!items.length) {
      toast.error('Adicione ao menos um item à lista de impressão');
      return;
    }
    setPrinting(true);
    try {
      printBarcodeLabels(items);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao imprimir etiquetas');
    } finally {
      setPrinting(false);
    }
  };

  const selectedEntries = Array.from(selected.entries());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Imprimir etiquetas"
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {selected.size} item(ns) na lista · {totalLabels} etiqueta(s)
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handlePrint} loading={printing} disabled={!selected.size}>
              <Printer className="h-4 w-4" /> Imprimir lista
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Monte a lista buscando e adicionando vários produtos ou kits. Depois defina a quantidade
          de cada etiqueta.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lista para impressão
            </h3>
            {selectedEntries.length > 0 && (
              <button
                type="button"
                onClick={clearList}
                className="text-xs font-medium text-slate-500 hover:text-red-600"
              >
                Limpar lista
              </button>
            )}
          </div>
          <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-primary-200 bg-primary-50/40 dark:border-primary-900 dark:bg-primary-950/20">
            {selectedEntries.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-500">
                Nenhum item na lista. Busque abaixo e clique em <strong>Adicionar</strong>.
              </li>
            ) : (
              selectedEntries.map(([key, item]) => (
                <li
                  key={key}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm',
                    kitRowClassName(item.isKit)
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                      {formatProductName(item.name)}
                      {item.isKit && <KitBadge />}
                    </span>
                    <span className="block font-mono text-xs text-slate-500">
                      {item.internalCode} · {item.barcode}
                    </span>
                  </span>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    Qtd
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={item.quantity}
                      onChange={(e) => setQuantity(key, e.target.value)}
                      className="input-field w-16 px-2 py-1 text-center text-sm"
                      aria-label={`Quantidade de etiquetas de ${item.name}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSelected(key)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                    aria-label={`Remover ${item.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Buscar e adicionar
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite nome, código ou barras..."
              className="input-field w-full pl-9"
            />
          </div>

          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-surface-border dark:border-slate-600">
            {isFetching && (
              <li className="px-3 py-4 text-center text-sm text-slate-500">Buscando...</li>
            )}
            {!isFetching && withBarcode.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-slate-500">
                Nenhum item com código de barras encontrado
                {!debounced.trim() && (
                  <span className="mt-1 block text-xs">Digite para buscar produtos ou kits</span>
                )}
              </li>
            )}
            {withBarcode.map((p) => {
              const isKit = p.productType === 'KIT';
              const already = isInList(p);
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm',
                    kitRowClassName(isKit),
                    already && 'opacity-70'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                      {formatProductName(p.name)}
                      {isKit && <KitBadge />}
                    </span>
                    <span className="block font-mono text-xs text-slate-500">
                      {p.internalCode} · {p.barcode}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={already ? 'secondary' : 'primary'}
                    disabled={already}
                    onClick={() => addToList(p)}
                  >
                    {already ? (
                      'Na lista'
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
