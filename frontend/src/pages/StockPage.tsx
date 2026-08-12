import { useState, useMemo, useEffect, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Boxes, MapPin, Search, X, Plus, ChevronLeft, ChevronRight, Printer, Package, Wrench } from 'lucide-react';
import api from '@/services/api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { PrintLabelsModal } from '@/components/products/PrintLabelsModal';
import { IncludeInactiveFilter } from '@/components/ui/IncludeInactiveFilter';
import { KitBadge, kitRowClassName } from '@/components/products/ProductTypeSelect';
import { KitAssemblyModal } from '@/components/movements/KitAssemblyModal';
import type { Product, StockItem } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/utils/cn';
import { formatProductName } from '@/utils/format';
import { useAuthStore } from '@/stores/authStore';
import { useDebounce } from '@/hooks/useDebounce';
import { useLocations } from '@/hooks/queries/useLocations';
import { queryKeys } from '@/lib/queryKeys';
import type { LabelItem } from '@/utils/printBarcodeLabels';

type ViewMode = 'stock' | 'kits';

export function StockPage() {
  const queryClient = useQueryClient();
  const canCreateProduct = useAuthStore((s) => s.hasPermission('products:CREATE'));
  const canEditProduct = useAuthStore((s) => s.hasPermission('products:UPDATE'));
  const canReadStock = useAuthStore((s) => s.hasPermission('stock:READ'));
  const canAssembleKit = useAuthStore((s) => s.hasPermission('movements:CREATE'));

  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [batch, setBatch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('stock');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [labelsModalOpen, setLabelsModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assemblyOpen, setAssemblyOpen] = useState(false);
  const [assemblyKitId, setAssemblyKitId] = useState<string | null>(null);

  const PAGE_SIZE = 100;

  const debouncedSearch = useDebounce(search, 350);
  const debouncedBatch = useDebounce(batch, 350);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, locationId, debouncedBatch, includeInactive, viewMode]);

  const { data: locations, isLoading: loadingLoc } = useLocations();

  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ['stock-items', debouncedSearch, locationId, debouncedBatch, includeInactive, page],
    queryFn: () =>
      api
        .get('/stock/items', {
          params: {
            search: debouncedSearch.trim() || undefined,
            locationId: locationId || undefined,
            batch: debouncedBatch.trim() || undefined,
            includeInactive: includeInactive ? 'true' : undefined,
            page,
            limit: PAGE_SIZE,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: viewMode === 'stock',
  });

  const { data: kits, isLoading: loadingKits } = useQuery({
    queryKey: ['kits', debouncedSearch, includeInactive, page],
    queryFn: () =>
      api
        .get('/products', {
          params: {
            search: debouncedSearch.trim() || undefined,
            productType: 'KIT',
            includeInactive: includeInactive ? 'true' : undefined,
            page,
            limit: PAGE_SIZE,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: viewMode === 'kits',
  });

  const total = viewMode === 'stock' ? items?.meta?.total : kits?.meta?.total;
  const totalPages =
    (viewMode === 'stock' ? items?.meta?.totalPages : kits?.meta?.totalPages) ?? 1;
  const hasPrev = (viewMode === 'stock' ? items?.meta?.hasPrev : kits?.meta?.hasPrev) ?? false;
  const hasNext = (viewMode === 'stock' ? items?.meta?.hasNext : kits?.meta?.hasNext) ?? false;

  const selectedLocation = useMemo(
    () => locations?.find((loc) => loc.id === locationId),
    [locations, locationId]
  );

  const toggleLocationFilter = (id: string) => {
    setLocationId((current) => (current === id ? '' : id));
  };

  const handleLocationCardKeyDown = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleLocationFilter(id);
    }
  };

  const handleProductSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    queryClient.invalidateQueries({ queryKey: ['kits'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.stockLocations });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const openCreateProduct = () => {
    setEditingProductId(null);
    setProductModalOpen(true);
  };

  const openEditProduct = (id: string) => {
    setEditingProductId(id);
    setProductModalOpen(true);
  };

  const closeProductModal = () => {
    setProductModalOpen(false);
    setEditingProductId(null);
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const preselectedLabels = useMemo((): LabelItem[] => {
    if (viewMode === 'stock') {
      const rows = (items?.data || []) as StockItem[];
      const byProduct = new Map<string, LabelItem>();
      for (const row of rows) {
        if (!selectedIds.has(row.id)) continue;
        const p = row.product;
        if (!p.barcode?.trim()) continue;
        byProduct.set(p.id, {
          name: p.name,
          barcode: p.barcode,
          internalCode: p.internalCode,
          isKit: p.productType === 'KIT',
        });
      }
      return Array.from(byProduct.values());
    }
    const kitRows = (kits?.data || []) as Product[];
    return kitRows
      .filter((k) => selectedIds.has(k.id) && k.barcode?.trim())
      .map((k) => ({
        name: k.name,
        barcode: k.barcode!,
        internalCode: k.internalCode,
        isKit: true,
      }));
  }, [viewMode, items?.data, kits?.data, selectedIds]);

  return (
    <div className="page-content">
      <PageHeader
        title="Estoque"
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {canReadStock && (
              <Button
                variant="secondary"
                onClick={() => setLabelsModalOpen(true)}
                className="w-full sm:w-auto"
              >
                <Printer className="h-4 w-4" /> Imprimir etiquetas
              </Button>
            )}
            {canAssembleKit && (
              <Button
                variant="secondary"
                onClick={() => {
                  setAssemblyKitId(null);
                  setAssemblyOpen(true);
                }}
                className="w-full sm:w-auto"
              >
                <Wrench className="h-4 w-4" /> Montar kit
              </Button>
            )}
            {canCreateProduct && (
              <Button onClick={openCreateProduct} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" /> Novo cadastro
              </Button>
            )}
          </div>
        }
      />

      {loadingLoc ? (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {locations?.map((loc) => {
            const selected = locationId === loc.id;
            return (
              <div
                key={loc.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setViewMode('stock');
                  toggleLocationFilter(loc.id);
                }}
                onKeyDown={(e) => handleLocationCardKeyDown(e, loc.id)}
                aria-pressed={selected}
                aria-label={`Filtrar por ${loc.name}${selected ? ' (ativo, clique para remover)' : ''}`}
                className={cn(
                  'card w-full cursor-pointer text-left outline-none transition select-none',
                  'hover:border-primary-400 hover:shadow-md dark:hover:border-primary-500',
                  'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                  selected &&
                    'border-2 border-primary-500 bg-primary-50 shadow-md dark:border-primary-400 dark:bg-primary-950/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin
                        className={cn(
                          'h-4 w-4',
                          selected ? 'text-primary-700 dark:text-primary-300' : 'text-primary-600'
                        )}
                      />
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{loc.name}</h3>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{loc.code}</p>
                    <Badge variant="info" className="mt-2">
                      {loc.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold leading-none text-primary-700 dark:text-primary-400">
                      {loc.totalQuantity ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">unidades</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-slate-400/75">
                      {loc.productCount ?? 0} {(loc.productCount ?? 0) === 1 ? 'produto' : 'produtos'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedLocation && viewMode === 'stock' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm dark:border-primary-800 dark:bg-primary-950/40">
          <p className="text-slate-700 dark:text-slate-200">
            Filtrando por{' '}
            <span className="font-semibold text-primary-800 dark:text-primary-200">
              {selectedLocation.name}
            </span>
            {typeof total === 'number' && (
              <span className="text-slate-500 dark:text-slate-400"> — {total} registro(s)</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setLocationId('')}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-700 transition hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900/60"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtro
          </button>
        </div>
      )}

      <div className="card space-y-4 !p-4 sm:!p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewMode('stock')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              viewMode === 'stock'
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
            )}
          >
            <Package className="h-4 w-4" /> Saldo em estoque
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kits')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
              viewMode === 'kits'
                ? 'bg-teal-600 text-white'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-200'
            )}
          >
            <Boxes className="h-4 w-4" /> Kits
          </button>
        </div>

        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="form-label" htmlFor="stock-search">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="stock-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Produto, código ou barras..."
                className="input-field w-full pl-9"
              />
            </div>
          </div>
          {viewMode === 'stock' && (
            <>
              <div>
                <label className="form-label" htmlFor="stock-location">
                  Local
                </label>
                <select
                  id="stock-location"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Todos os locais</option>
                  {locations?.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="stock-batch">
                  Lote
                </label>
                <input
                  id="stock-batch"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="Nº do lote..."
                  className="input-field w-full"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {typeof total === 'number' ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {total} registro(s) encontrado(s)
              {total > PAGE_SIZE
                ? ` — exibindo ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`
                : ''}
              {selectedIds.size > 0 ? ` · ${selectedIds.size} selecionado(s)` : ''}
            </p>
          ) : (
            <span />
          )}
          <IncludeInactiveFilter checked={includeInactive} onChange={setIncludeInactive} />
        </div>
      </div>

      {viewMode === 'stock' ? (
        <DataTable<StockItem>
          loading={loadingItems}
          data={items?.data || []}
          virtualized
          emptyIcon={Boxes}
          emptyTitle="Nenhum item encontrado"
          emptyDescription="Ajuste os filtros ou cadastre entradas de estoque."
          onRowClick={canEditProduct ? (item) => openEditProduct(item.product.id) : undefined}
          getRowClassName={(i) => kitRowClassName(i.product.productType === 'KIT')}
          columns={[
            {
              key: 'select',
              header: '',
              className: 'w-10',
              render: (i) => (
                <input
                  type="checkbox"
                  checked={selectedIds.has(i.id)}
                  onChange={() => toggleSelect(i.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600"
                  aria-label={`Selecionar ${i.product.name}`}
                />
              ),
            },
            {
              key: 'product',
              header: 'Produto',
              render: (i) => (
                <span className="flex items-center gap-2">
                  {formatProductName(i.product.name)}
                  {i.product.productType === 'KIT' && <KitBadge />}
                  {i.product.active === false && <Badge variant="default">Inativo</Badge>}
                </span>
              ),
            },
            { key: 'code', header: 'Código', render: (i) => i.product.internalCode },
            {
              key: 'barcode',
              header: 'Barras',
              render: (i) => i.product.barcode || '—',
              hideBelow: 'md',
            },
            { key: 'location', header: 'Local', render: (i) => i.location.name },
            { key: 'lot', header: 'Lote', render: (i) => i.batch?.batchNumber || '-' },
            {
              key: 'qty',
              header: 'Quantidade',
              render: (i) => <span className="font-semibold">{i.quantity}</span>,
            },
          ]}
        />
      ) : (
        <DataTable<Product>
          loading={loadingKits}
          data={kits?.data || []}
          virtualized
          emptyIcon={Boxes}
          emptyTitle="Nenhum kit encontrado"
          emptyDescription="Cadastre um kit pelo botão Novo cadastro."
          onRowClick={canEditProduct ? (kit) => openEditProduct(kit.id) : undefined}
          getRowClassName={() => kitRowClassName(true)}
          columns={[
            {
              key: 'select',
              header: '',
              className: 'w-10',
              render: (k) => (
                <input
                  type="checkbox"
                  checked={selectedIds.has(k.id)}
                  onChange={() => toggleSelect(k.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600"
                  aria-label={`Selecionar ${k.name}`}
                />
              ),
            },
            {
              key: 'name',
              header: 'Kit',
              render: (k) => (
                <span className="flex items-center gap-2">
                  {formatProductName(k.name)}
                  <KitBadge />
                  {k.active === false && <Badge variant="default">Inativo</Badge>}
                </span>
              ),
            },
            { key: 'code', header: 'Código', render: (k) => k.internalCode },
            {
              key: 'barcode',
              header: 'EAN-13',
              render: (k) => <span className="font-mono text-xs">{k.barcode || '—'}</span>,
            },
            {
              key: 'items',
              header: 'Itens',
              render: (k) => k.kitItems?.length ?? 0,
            },
            {
              key: 'stock',
              header: 'Estoque',
              render: (k) => k.totalStock ?? 0,
            },
            { key: 'category', header: 'Categoria', render: (k) => k.category?.name || '—' },
            ...(canAssembleKit
              ? [
                  {
                    key: 'assemble',
                    header: '',
                    render: (k: Product) => (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssemblyKitId(k.id);
                          setAssemblyOpen(true);
                        }}
                      >
                        <Wrench className="h-4 w-4" /> Montar
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPrev || loadingItems || loadingKits}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasNext || loadingItems || loadingKits}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {(canCreateProduct || canEditProduct) && (
        <ProductFormModal
          open={productModalOpen}
          onClose={closeProductModal}
          productId={editingProductId}
          onSuccess={handleProductSaved}
        />
      )}

      <PrintLabelsModal
        open={labelsModalOpen}
        onClose={() => setLabelsModalOpen(false)}
        preselected={preselectedLabels}
      />

      {canAssembleKit && (
        <KitAssemblyModal
          open={assemblyOpen}
          onClose={() => {
            setAssemblyOpen(false);
            setAssemblyKitId(null);
          }}
          initialKitId={assemblyKitId}
          onSuccess={handleProductSaved}
        />
      )}
    </div>
  );
}
