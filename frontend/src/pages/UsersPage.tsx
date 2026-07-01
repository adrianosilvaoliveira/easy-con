import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Users, Search, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { IncludeInactiveFilter } from '@/components/ui/IncludeInactiveFilter';
import { ActiveToggleField } from '@/components/ui/ActiveToggleField';
import { useAuthStore } from '@/stores/authStore';
import { getRoleLabel, ASSIGNABLE_ROLES, type AssignableRole } from '@/constants/roles';
import { UserAccessEditor } from '@/components/users/UserAccessEditor';

interface UserListRecord {
  id: string;
  name: string;
  email: string;
  active: boolean;
  useCustomAccess: boolean;
  role: { name: string };
}

interface UserDetail extends UserListRecord {
  rolePermissions: string[];
  customPermissions: string[];
  effectivePermissions: string[];
}

const baseUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

const createUserSchema = baseUserSchema.extend({
  password: z.string().min(8),
});

type CreateFormData = z.infer<typeof createUserSchema>;
type EditFormData = z.infer<typeof baseUserSchema> & { password?: string };

interface UsersPageProps {
  /** Renderizado dentro de Configurações (sem cabeçalho de página) */
  embedded?: boolean;
}

export function UsersPage({ embedded = false }: UsersPageProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageUsers =
    hasPermission('users:CREATE') || hasPermission('users:UPDATE');

  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [roleName, setRoleName] = useState<AssignableRole>('OPERACIONAL');
  const [useCustomAccess, setUseCustomAccess] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, includeInactive],
    queryFn: () =>
      api
        .get('/users', {
          params: {
            search: search || undefined,
            includeInactive: includeInactive ? 'true' : undefined,
            limit: 100,
          },
        })
        .then((r) => r.data),
  });

  const { data: editingUser, isLoading: loadingUser } = useQuery({
    queryKey: ['user', editingId],
    queryFn: () => api.get(`/users/${editingId}`).then((r) => r.data.data as UserDetail),
    enabled: !!editingId && modalOpen,
  });

  const isEdit = !!editingId;

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createUserSchema),
  });

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(baseUserSchema),
  });

  useEffect(() => {
    if (editingUser && isEdit) {
      editForm.reset({
        name: editingUser.name,
        email: editingUser.email,
        password: '',
      });
      setActive(editingUser.active);
      const role = editingUser.role.name as AssignableRole;
      setRoleName(ASSIGNABLE_ROLES.includes(role) ? role : 'OPERACIONAL');
      setUseCustomAccess(editingUser.useCustomAccess);
      setSelectedPermissions(
        editingUser.useCustomAccess
          ? editingUser.customPermissions
          : editingUser.rolePermissions
      );
    }
  }, [editingUser, isEdit, editForm]);

  const buildAccessPayload = () => ({
    roleName,
    useCustomAccess: roleName !== 'ADMINISTRADOR' && useCustomAccess,
    permissions:
      roleName !== 'ADMINISTRADOR' && useCustomAccess ? selectedPermissions : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) =>
      api.post('/users', { ...data, ...buildAccessPayload() }),
    onSuccess: () => {
      toast.success('Usuário criado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao criar usuário'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditFormData) => {
      const body: Record<string, unknown> = {
        ...data,
        active,
        ...buildAccessPayload(),
      };
      if (!data.password) delete body.password;
      return api.put(`/users/${editingId}`, body);
    },
    onSuccess: () => {
      toast.success('Usuário e nível de acesso atualizados');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message || 'Erro ao atualizar usuário'),
  });

  const resetAccessState = () => {
    setRoleName('OPERACIONAL');
    setUseCustomAccess(false);
    setSelectedPermissions([]);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    resetAccessState();
    createForm.reset();
    editForm.reset();
  };

  const openCreate = () => {
    setEditingId(null);
    resetAccessState();
    createForm.reset();
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setModalOpen(true);
  };

  return (
    <div className={embedded ? 'space-y-4' : 'page-content'}>
      {!embedded && (
        <PageHeader
          title="Usuários"
          action={
            canManageUsers ? (
              <Button onClick={openCreate} className="w-full sm:w-auto">
                <Plus className="h-4 w-4" /> Novo Usuário
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome ou e-mail..."
            className="input-field w-full pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IncludeInactiveFilter checked={includeInactive} onChange={setIncludeInactive} />
          {embedded && canManageUsers && (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Novo Usuário
            </Button>
          )}
        </div>
      </div>

      <DataTable<UserListRecord>
        loading={isLoading}
        data={data?.data || []}
        emptyIcon={Users}
        columns={[
          { key: 'name', header: 'Nome', render: (u) => u.name },
          { key: 'email', header: 'E-mail', render: (u) => u.email },
          {
            key: 'role',
            header: 'Nível de acesso',
            render: (u) => (
              <div className="flex flex-wrap gap-1">
                <Badge variant="info">{getRoleLabel(u.role.name)}</Badge>
                {u.useCustomAccess && u.role.name !== 'ADMINISTRADOR' && (
                  <Badge variant="default">Personalizado</Badge>
                )}
              </div>
            ),
          },
          {
            key: 'active',
            header: 'Status',
            render: (u) => (
              <Badge variant={u.active ? 'success' : 'default'}>
                {u.active ? 'Ativo' : 'Inativo'}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (u) =>
              canManageUsers ? (
                <Button variant="secondary" size="sm" onClick={() => openEdit(u.id)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : null,
          },
        ]}
      />

      {canManageUsers && (
        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={isEdit ? 'Editar usuário e acesso' : 'Novo usuário'}
          size="xl"
        >
          {isEdit && loadingUser ? (
            <p className="py-8 text-center text-sm text-slate-500">Carregando...</p>
          ) : isEdit ? (
            <form
              onSubmit={editForm.handleSubmit((d) => updateMutation.mutate(d))}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Input label="Nome *" {...editForm.register('name')} />
              <Input label="E-mail *" type="email" {...editForm.register('email')} />
              <Input
                label="Nova senha (opcional)"
                type="password"
                placeholder="Deixe em branco para manter"
                {...editForm.register('password')}
              />
              <UserAccessEditor
                roleName={roleName}
                useCustomAccess={useCustomAccess}
                selectedPermissions={selectedPermissions}
                onRoleChange={setRoleName}
                onUseCustomAccessChange={setUseCustomAccess}
                onPermissionsChange={setSelectedPermissions}
              />
              <ActiveToggleField active={active} onChange={setActive} />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button variant="secondary" type="button" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" loading={updateMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Input label="Nome *" {...createForm.register('name')} />
              <Input label="E-mail *" type="email" {...createForm.register('email')} />
              <Input label="Senha *" type="password" {...createForm.register('password')} />
              <UserAccessEditor
                roleName={roleName}
                useCustomAccess={useCustomAccess}
                selectedPermissions={selectedPermissions}
                onRoleChange={setRoleName}
                onUseCustomAccessChange={setUseCustomAccess}
                onPermissionsChange={setSelectedPermissions}
              />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button variant="secondary" type="button" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" loading={createMutation.isPending}>
                  Criar
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
