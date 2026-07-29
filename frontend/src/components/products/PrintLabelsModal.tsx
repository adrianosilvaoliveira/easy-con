import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Search } from 'lucide-react';
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

interface PrintLabelsModalProps {
  open: boolean;
  onClose: () => void;
  /** Produtos/kits pré-selecionados (ex.: da tabela de estoque) */
  preselected?: LabelItem[];
}

export function PrintLabelsModal({ open, onClose, preselected = [] }: PrintLabelsModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Map<string, LabelItem>>(new Map());
  const [printing, setPrinting] = useState(false);
  const debounced = useDebounce(search, 300);

  useEffect(() => {
    if (!open) return;
    const map = new Map<string, LabelItem>();
    preselected.forEach((item, index) => {
      if (item.barcode?.trim()) {
        map.set(`pre-${index}-${item.barcode}`, item);
      }
    });
    setSelected(map);
    setSearch('');
  }, [open, preselected]);

  const { data: products = [], isFetching } = useQuery({
    queryKey: ['products-labels', debounced],
    queryFn: () =>
      api
        .get('/products', {
          params: { search: debounced.trim() || undefined, limit: 50 },
        })
        .then((r) => r.data.data as Product[]),
    enabled: open,
  });

  const withBarcode = products.filter((p) => p.barcode?.trim());

  const isSelected = (product: Product) => {
    if (selected.has(product.id)) return true;
    for (const item of selected.values()) {
      if (item.barcode === product.barcode && item.internalCode === product.internalCode) {
        return true;
      }
    }
    return false;
  };

  const toggle = (product: Product) => {
    if (!product.barcode?.trim()) return;
    setSelected((prev) => {
      const next = new Map(prev);
      let already = next.has(product.id);
      if (!already) {
        for (const item of next.values()) {
          if (
            item.barcode === product.barcode &&
            item.internalCode === product.internalCode
          ) {
            already = true;
            break;
          }
        }
      }
      for (const [key, item] of [...next.entries()]) {
        if (
          key === product.id ||
          (item.barcode === product.barcode && item.internalCode === product.internalCode)
        ) {
          next.delete(key);
        }
      }
      if (!already) {
        next.set(product.id, {
          name: product.name,
          barcode: product.barcode!,
          internalCode: product.internalCode,
          isKit: product.productType === 'KIT',
        });
      }
      return next;
    });
  };

  const handlePrint = () => {
    const items = Array.from(selected.values());
    if (!items.length) {
      toast.error('Selecione ao menos um item com código de barras');
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Imprimir etiquetas"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{selected.size} selecionado(s)</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handlePrint} loading={printing} disabled={!selected.size}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Selecione produtos e kits com código de barras para gerar as etiquetas.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto ou kit..."
            className="input-field w-full pl-9"
          />
        </div>

        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-surface-border dark:border-slate-600">
          {isFetching && (
            <li className="px-3 py-4 text-center text-sm text-slate-500">Buscando...</li>
          )}
          {!isFetching && withBarcode.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-slate-500">
              Nenhum item com código de barras encontrado
            </li>
          )}
          {withBarcode.map((p) => {
            const isKit = p.productType === 'KIT';
            const checked = isSelected(p);
            return (
              <li key={p.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50',
                    kitRowClassName(isKit),
                    checked && 'bg-primary-50/50 dark:bg-primary-950/30'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                      {formatProductName(p.name)}
                      {isKit && <KitBadge />}
                    </span>
                    <span className="block font-mono text-xs text-slate-500">
                      {p.internalCode} · {p.barcode}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
