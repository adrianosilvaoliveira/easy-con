import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { IncludeInactiveFilter } from '@/components/ui/IncludeInactiveFilter';
import { ActiveToggleField } from '@/components/ui/ActiveToggleField';
import { useAuthStore } from '@/stores/authStore';
import { DeleteCadastroSection } from '@/components/cadastros/DeleteCadastroSection';
import { ProductCatalogPanel } from '@/components/products/ProductCatalogPanel';
import { ROUTE_PERMISSIONS } from '@/routes/routePermissions';

type Tab = 'categories' | 'products' | 'suppliers' | 'locations';

interface ActiveEntity {
  id: string;
  name: string;
  active: boolean;
}

interface DeleteCheck {
  canDelete: boolean;
  reasons: string[];
}

export function CadastrosPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canDeleteLocation = hasPermission('stock:DELETE');
  const canDeleteCategory = hasPermission('products:DELETE');
  const canViewProducts = hasPermission(ROUTE_PERMISSIONS.produtos);
  const [searchParams] = useSearchParams();
  const initialTab: Tab =
    searchParams.get('aba') === 'produtos' && canViewProducts ? 'products' : 'categories';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [active, setActive] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'categories', label: 'Categorias' },
    ...(canViewProducts ? [{ id: 'products' as const, label: 'Produtos' }] : []),
    { id: 'suppliers', label: 'Fornecedores' },
    { id: 'locations', label: 'Locais de Estoque' },
  ];

  const endpoint =
    tab === 'categories'
      ? '/products/categories'
      : tab === 'suppliers'
        ? '/suppliers'
        : tab === 'locations'
          ? '/stock/locations'
          : null;

  const editingLocationId =
    tab === 'locations' && editing?.id ? String(editing.id) : null;
  const editingCategoryId =
    tab === 'categories' && editing?.id ? String(editing.id) : null;

  const { data: locationDeleteCheck, isLoading: loadingLocationDeleteCheck } = useQuery({
    queryKey: ['location-delete-check', editingLocationId],
    queryFn: () =>
      api
        .get(`/stock/locations/${editingLocationId}/delete-check`)
        .then((r) => r.data.data as DeleteCheck),
    enabled: !!editingLocationId && modalOpen && canDeleteLocation,
  });

  const { data: categoryDeleteCheck, isLoading: loadingCategoryDeleteCheck } = useQuery({
    queryKey: ['category-delete-check', editingCategoryId],
    queryFn: () =>
      api
        .get(`/products/categories/${editingCategoryId}/delete-check`)
        .then((r) => r.data.data as DeleteCheck),
    enabled: !!editingCategoryId && modalOpen && canDeleteCategory,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: [tab, search, includeInactive],
    queryFn: () =>
      api
        .get(endpoint!, {
          params: {
            search: search || undefined,
            includeInactive: includeInactive ? 'true' : undefined,
          },
        })
        .then((r) => r.data.data as ActiveEntity[]),
    enabled: tab !== 'products' && !!endpoint,
  });

  const openCreate = () => {
    setEditing(null);
    setActive(true);
    setForm(tab === 'locations' ? { name: '', code: '', type: 'CENTRAL', description: '' } : { name: '' });
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setActive((row.active as boolean) ?? true);
    setForm({
      name: String(row.name || ''),
      code: String(row.code || ''),
      type: String(row.type || 'CENTRAL'),
      description: String(row.description || ''),
      cnpj: String(row.cnpj || ''),
      email: String(row.email || ''),
      phone: String(row.phone || ''),
      address: String(row.address || ''),
    });
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!endpoint) throw new Error('Cadastro inválido');
      const body: Record<string, unknown> = { ...form };
      if (editing) {
        body.active = active;
        return api.put(`${endpoint}/${editing.id}`, body);
      }
      return api.post(endpoint, body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Atualizado' : 'Cadastrado');
      queryClient.invalidateQueries({ queryKey: [tab] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setModalOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao salvar'),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/stock/locations/${id}`),
    onSuccess: () => {
      toast.success('Local excluído');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Não foi possível excluir o local'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/categories/${id}`),
    onSuccess: () => {
      toast.success('Categoria excluída');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Não foi possível excluir a categoria'),
  });

  const confirmPermanentDelete = (label: string, name: string) =>
    window.confirm(
      `Excluir permanentemente ${label} "${name}"?\n\nEsta ação não pode ser desfeita.`
    );

  const handleDeleteLocation = () => {
    if (!editing?.id || !locationDeleteCheck?.canDelete) return;
    const name = String(form.name || 'este local');
    if (!confirmPermanentDelete('o local', name)) return;
    deleteLocationMutation.mutate(String(editing.id));
  };

  const handleDeleteCategory = () => {
    if (!editing?.id || !categoryDeleteCheck?.canDelete) return;
    const name = String(form.name || 'esta categoria');
    if (!confirmPermanentDelete('a categoria', name)) return;
    deleteCategoryMutation.mutate(String(editing.id));
  };

  const showDeleteSection =
    editing &&
    ((tab === 'locations' && canDeleteLocation) || (tab === 'categories' && canDeleteCategory));

  useEffect(() => {
    setSearch('');
  }, [tab]);

  const modalTitle =
    tab === 'categories'
      ? editing
        ? 'Editar Categoria'
        : 'Nova Categoria'
      : tab === 'suppliers'
        ? editing
          ? 'Editar Fornecedor'
          : 'Novo Fornecedor'
        : editing
          ? 'Editar Local'
          : 'Novo Local';

  return (
    <div className="page-content">
      <PageHeader title="Cadastros" />

      <div className="mb-4 flex flex-wrap gap-2 border-b border-surface-border pb-2 dark:border-slate-600">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'products' ? (
        <ProductCatalogPanel allowCreate allowEdit />
      ) : (
        <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="input-field w-full pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IncludeInactiveFilter checked={includeInactive} onChange={setIncludeInactive} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </div>

      <DataTable<ActiveEntity>
        loading={isLoading}
        data={data}
        columns={[
          { key: 'name', header: 'Nome', render: (r) => r.name },
          ...(tab === 'locations'
            ? [
                {
                  key: 'code',
                  header: 'Código',
                  render: (r: ActiveEntity & { code?: string }) => r.code || '-',
                },
              ]
            : []),
          {
            key: 'status',
            header: 'Status',
            render: (r) => (
              <Badge variant={r.active ? 'success' : 'default'}>
                {r.active ? 'Ativo' : 'Inativo'}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <Button variant="secondary" size="sm" onClick={() => openEdit(r as unknown as Record<string, unknown>)}>
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          {tab === 'locations' && (
            <>
              <Input
                label="Código *"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
              <div>
                <label className="form-label">Tipo *</label>
                <select
                  className="input-field"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  <option value="CENTRAL">Central</option>
                  <option value="CENTRO_CIRURGICO">Centro Cirúrgico</option>
                  <option value="CONSULTORIO">Consultório</option>
                  <option value="FARMACIA">Farmácia</option>
                  <option value="SATELITE">Satélite</option>
                </select>
              </div>
              <Input
                label="Descrição"
                className="sm:col-span-2"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </>
          )}
          {tab === 'suppliers' && (
            <>
              <Input label="CNPJ" value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
              <Input label="E-mail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Input label="Telefone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <Input label="Endereço" className="sm:col-span-2" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </>
          )}
          {editing && (tab === 'categories' || tab === 'locations') && (
            <ActiveToggleField active={active} onChange={setActive} />
          )}
          {editing && tab === 'suppliers' && (
            <ActiveToggleField active={active} onChange={setActive} />
          )}
          {editing && tab === 'locations' && canDeleteLocation && (
            <DeleteCadastroSection
              title="Excluir local"
              entityLabel="local"
              canDelete={!!locationDeleteCheck?.canDelete}
              reasons={locationDeleteCheck?.reasons ?? []}
              okMessage="Este local não possui produtos, movimentações nem inventários vinculados."
              loading={deleteLocationMutation.isPending}
              checking={loadingLocationDeleteCheck}
              onDelete={handleDeleteLocation}
            />
          )}
          {editing && tab === 'categories' && canDeleteCategory && (
            <DeleteCadastroSection
              title="Excluir categoria"
              entityLabel="categoria"
              canDelete={!!categoryDeleteCheck?.canDelete}
              reasons={categoryDeleteCheck?.reasons ?? []}
              okMessage="Nenhum produto está vinculado a esta categoria."
              loading={deleteCategoryMutation.isPending}
              checking={loadingCategoryDeleteCheck}
              onDelete={handleDeleteCategory}
            />
          )}
          <div className={`flex gap-2 sm:col-span-2 ${showDeleteSection ? 'justify-between' : 'justify-end'}`}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
        </>
      )}
    </div>
  );
}
