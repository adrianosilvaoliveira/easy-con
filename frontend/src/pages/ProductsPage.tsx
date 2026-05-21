import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Package, Search, Pencil } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { IncludeInactiveFilter } from '@/components/ui/IncludeInactiveFilter';
import type { Product, PaginatedResponse } from '@/types';

export function ProductsPage() {
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
    <div className="page-content">
      <PageHeader
        title="Produtos"
        action={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        }
      />

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
        <IncludeInactiveFilter checked={includeInactive} onChange={setIncludeInactive} />
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
            header: 'Estoque',
            render: (p) =>
              (p.totalStock ?? 0) < p.minQuantity ? (
                <Badge variant="danger">Abaixo do mínimo</Badge>
              ) : (
                <Badge variant="success">OK</Badge>
              ),
            hideBelow: 'md',
          },
          {
            key: 'actions',
            header: '',
            render: (p) => (
              <Button variant="secondary" size="sm" onClick={() => openEdit(p.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          },
        ]}
      />

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        productId={editingId}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
