import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Package, Search, Pencil } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { IncludeInactiveFilter } from '@/components/ui/IncludeInactiveFilter';
import { useAuthStore } from '@/stores/authStore';
import type { Product, PaginatedResponse } from '@/types';

interface ProductCatalogPanelProps {
  /** Exibe botão "Novo Produto" (cadastros) */
  allowCreate?: boolean;
  /** Permite editar produtos existentes */
  allowEdit?: boolean;
}

export function ProductCatalogPanel({ allowCreate = false, allowEdit = true }: ProductCatalogPanelProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = allowCreate && hasPermission('products:CREATE');
  const canEdit = allowEdit && hasPermission('products:UPDATE');

  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', search, includeInactive],
    queryFn: () =>
      api
        .get<PaginatedResponse<Product>>('/products', {
          params: {
            search: search || undefined,
            includeInactive: includeInactive ? 'true' : undefined,
            limit: 100,
          },
        })
        .then((r) => r.data),
  });

  const openCreate = () => {
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, código ou barras..."
            className="input-field w-full pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IncludeInactiveFilter checked={includeInactive} onChange={setIncludeInactive} />
          {canCreate && (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          )}
        </div>
      </div>

      <DataTable<Product>
        loading={isLoading}
        data={data?.data || []}
        emptyIcon={Package}
        emptyTitle="Nenhum produto encontrado"
        columns={[
          {
            key: 'code',
            header: 'Código',
            render: (p) => <span className="font-mono text-xs">{p.internalCode}</span>,
          },
          { key: 'name', header: 'Nome', render: (p) => p.name },
          { key: 'category', header: 'Categoria', render: (p) => p.category.name },
          { key: 'stock', header: 'Estoque', render: (p) => p.totalStock ?? 0 },
          {
            key: 'status',
            header: 'Status',
            render: (p) => (
              <Badge variant={p.active !== false ? 'success' : 'default'}>
                {p.active !== false ? 'Ativo' : 'Inativo'}
              </Badge>
            ),
          },
          {
            key: 'stockAlert',
            header: 'Alerta',
            render: (p) =>
              (p.totalStock ?? 0) < p.minQuantity ? (
                <Badge variant="danger">Abaixo do mínimo</Badge>
              ) : (
                <Badge variant="success">OK</Badge>
              ),
            hideBelow: 'md',
          },
          ...(canEdit
            ? [
                {
                  key: 'actions',
                  header: '',
                  render: (p: Product) => (
                    <Button variant="secondary" size="sm" onClick={() => openEdit(p.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      {(canCreate || canEdit) && (
        <ProductFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          productId={editingId}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}
