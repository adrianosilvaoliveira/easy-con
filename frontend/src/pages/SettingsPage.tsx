import { Suspense, lazy, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Moon, Sun } from 'lucide-react';
import { ROUTE_PERMISSIONS } from '@/routes/routePermissions';
import { PageHeader } from '@/components/ui/PageHeader';
import { SettingsNavItem } from '@/components/settings/SettingsNavItem';
import { SettingsGroupPanel } from '@/components/settings/SettingsGroupPanel';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { getRoleLabel } from '@/constants/roles';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import { RouteFallback } from '@/components/ui/RouteFallback';
import api from '@/services/api';
import type { OrganizationSettings, User } from '@/types';

const UsersPage = lazy(() => import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const OperationalCadastrosPanel = lazy(() =>
  import('@/components/cadastros/OperationalCadastrosPanel').then((m) => ({
    default: m.OperationalCadastrosPanel,
  }))
);

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

type SettingsSection = 'gerais' | 'empresa' | 'aparencia' | 'usuarios' | 'cadastros';

const NAV_ITEMS: { id: SettingsSection; label: string; description: string; permission?: string }[] = [
  { id: 'gerais', label: 'Gerais', description: 'Conta e perfil de acesso' },
  { id: 'empresa', label: 'Empresa', description: 'Dados institucionais e relatórios' },
  { id: 'cadastros', label: 'Fornecedores e locais', description: 'Cadastros operacionais', permission: ROUTE_PERMISSIONS.cadastros },
  { id: 'usuarios', label: 'Usuários', description: 'Contas e permissões de acesso', permission: ROUTE_PERMISSIONS.usuarios },
  { id: 'aparencia', label: 'Aparência', description: 'Tema e visualização' },
];

function sectionFromPath(pathname: string): SettingsSection {
  const segment = pathname.replace(/^\/configuracoes\/?/, '').split('/')[0];
  if (segment === 'empresa' || segment === 'aparencia' || segment === 'usuarios' || segment === 'cadastros') return segment;
  return 'gerais';
}

const organizationSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  cnpj: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email('E-mail inválido'), z.literal('')]).optional(),
});

type OrganizationForm = z.infer<typeof organizationSchema>;

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = sectionFromPath(location.pathname);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEditOrg = hasPermission('settings:UPDATE');
  const darkMode = useThemeStore((s) => s.darkMode);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);
  const avatarUrl = user?.avatarUrl;
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const canReadOrg = hasPermission('settings:READ');
  const canReadUsers = hasPermission(ROUTE_PERMISSIONS.usuarios);
  const canReadCadastros = hasPermission(ROUTE_PERMISSIONS.cadastros);
  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.id === 'empresa' && !canReadOrg) return false;
    if (item.id === 'cadastros' && !canReadCadastros) return false;
    if (item.id === 'usuarios' && !canReadUsers) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  });

  useEffect(() => {
    if (location.pathname === '/configuracoes' || location.pathname === '/configuracoes/') {
      navigate('/configuracoes/gerais', { replace: true });
      return;
    }
    if (activeSection === 'usuarios' && !canReadUsers) {
      navigate('/configuracoes/gerais', { replace: true });
    }
    if (activeSection === 'empresa' && !canReadOrg) {
      navigate('/configuracoes/gerais', { replace: true });
    }
    if (activeSection === 'cadastros' && !canReadCadastros) {
      navigate('/configuracoes/gerais', { replace: true });
    }
  }, [location.pathname, activeSection, canReadUsers, canReadOrg, canReadCadastros, navigate]);

  const pageTitle =
    activeSection === 'usuarios'
      ? 'Usuários'
      : activeSection === 'cadastros'
        ? 'Fornecedores e locais'
        : 'Configurações';

  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['organization'],
    enabled: canReadOrg,
    queryFn: () =>
      api.get<{ success: boolean; data: OrganizationSettings }>('/organization').then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OrganizationForm>({
    resolver: zodResolver(organizationSchema),
    values: organization
      ? {
          name: organization.name,
          cnpj: organization.cnpj ?? '',
          address: organization.address ?? '',
          phone: organization.phone ?? '',
          email: organization.email ?? '',
        }
      : undefined,
  });

  const saveOrg = useMutation({
    mutationFn: (data: OrganizationForm) =>
      api.put<{ success: boolean; data: OrganizationSettings }>('/organization', {
        name: data.name,
        cnpj: data.cnpj || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Dados da empresa atualizados.');
    },
    onError: () => toast.error('Não foi possível salvar os dados da empresa.'),
  });

  const saveAvatar = useMutation({
    mutationFn: (avatarUrl: string) =>
      api.put<{ success: boolean; data: User }>('/auth/me/avatar', { avatarUrl }),
    onSuccess: (res) => {
      setUser(res.data.data);
      toast.success('Foto atualizada.');
    },
    onError: () => toast.error('Não foi possível salvar a foto.'),
  });

  const removeAvatar = useMutation({
    mutationFn: () => api.delete<{ success: boolean; data: User }>('/auth/me/avatar'),
    onSuccess: (res) => {
      setUser(res.data.data);
      toast.success('Foto removida.');
    },
    onError: () => toast.error('Não foi possível remover a foto.'),
  });

  const onPickPhoto = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Imagem muito grande. Máximo 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveAvatar.mutate(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page-content">
      <PageHeader title={pageTitle} />

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <nav className="flex flex-col gap-2 lg:w-72 lg:shrink-0" aria-label="Grupos de configuração">
            {visibleNav.map((item) => (
              <SettingsNavItem
                key={item.id}
                label={item.label}
                description={item.description}
                active={activeSection === item.id}
                onClick={() => navigate(`/configuracoes/${item.id}`)}
              />
            ))}
          </nav>

          <div className="min-w-0 flex-1">
            {activeSection === 'gerais' && (
              <SettingsGroupPanel
                groupTitle="Gerais"
                sectionTitle="Dados da conta"
                sectionHint="Foto e informações do seu usuário de acesso."
              >
                <div className="flex flex-wrap items-start gap-4">
                  <UserAvatar
                    name={user?.name ?? ''}
                    imageUrl={avatarUrl}
                    size="md"
                    className="!h-16 !w-16 !text-lg"
                  />
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPickPhoto(e.target.files?.[0])}
                    />
                    <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} loading={saveAvatar.isPending}>
                      Trocar foto
                    </Button>
                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => removeAvatar.mutate()}
                        loading={removeAvatar.isPending}
                      >
                        Remover foto
                      </Button>
                    )}
                    <p className="text-xs text-slate-500">PNG ou JPG, até 2 MB.</p>
                  </div>
                </div>

                <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Nome</dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{user?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">E-mail</dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{user?.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Perfil</dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                      {user?.role ? getRoleLabel(user.role) : ''}
                    </dd>
                  </div>
                </dl>
              </SettingsGroupPanel>
            )}

            {activeSection === 'empresa' && canReadOrg && (
              <SettingsGroupPanel
                groupTitle="Empresa"
                sectionTitle="Dados gerais"
                sectionHint="Exibidos em relatórios PDF e documentos do sistema."
              >
                {orgLoading ? (
                  <p className="text-sm text-slate-500">Carregando...</p>
                ) : (
                  <form onSubmit={handleSubmit((d) => saveOrg.mutate(d))}>
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="lg:col-span-3">
                        <Input
                          label="Nome / Razão social"
                          error={errors.name?.message}
                          disabled={!canEditOrg}
                          {...register('name')}
                        />
                      </div>
                      <Input
                        label="CNPJ"
                        placeholder="00.000.000/0001-00"
                        error={errors.cnpj?.message}
                        disabled={!canEditOrg}
                        {...register('cnpj')}
                      />
                      <Input
                        label="Telefone"
                        placeholder="(67) 0000-0000"
                        error={errors.phone?.message}
                        disabled={!canEditOrg}
                        {...register('phone')}
                      />
                      <Input
                        label="E-mail institucional"
                        type="email"
                        error={errors.email?.message}
                        disabled={!canEditOrg}
                        {...register('email')}
                      />
                      <div className="space-y-1 lg:col-span-3">
                        <label
                          htmlFor="address"
                          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                          Endereço
                        </label>
                        <textarea
                          id="address"
                          rows={3}
                          className="input-field resize-y"
                          placeholder="Rua, número, cidade, UF"
                          disabled={!canEditOrg}
                          {...register('address')}
                        />
                      </div>
                    </div>

                    {canEditOrg ? (
                      <div className="mt-6 flex flex-wrap gap-2 border-t border-dashed border-surface-border pt-4 dark:border-slate-600">
                        <Button type="submit" loading={saveOrg.isPending} disabled={!isDirty}>
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!isDirty || saveOrg.isPending}
                          onClick={() =>
                            organization &&
                            reset({
                              name: organization.name,
                              cnpj: organization.cnpj ?? '',
                              address: organization.address ?? '',
                              phone: organization.phone ?? '',
                              email: organization.email ?? '',
                            })
                          }
                        >
                          Desfazer
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
                        Você pode visualizar, mas não editar os dados da empresa.
                      </p>
                    )}
                  </form>
                )}
              </SettingsGroupPanel>
            )}

            {activeSection === 'cadastros' && canReadCadastros && (
              <SettingsGroupPanel
                groupTitle="Cadastros operacionais"
                sectionTitle="Fornecedores e locais de estoque"
                sectionHint="Gerencie fornecedores, locais de estoque e categorias de produtos."
              >
                <Suspense fallback={<RouteFallback />}>
                  <OperationalCadastrosPanel />
                </Suspense>
              </SettingsGroupPanel>
            )}

            {activeSection === 'usuarios' && canReadUsers && (
              <Suspense fallback={<RouteFallback />}>
                <UsersPage embedded />
              </Suspense>
            )}

            {activeSection === 'aparencia' && (
              <SettingsGroupPanel
                groupTitle="Aparência"
                sectionTitle="Visualização"
                sectionHint="Preferências de tema da interface."
              >
                <div className="flex items-center justify-between rounded-lg border border-surface-border bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    {darkMode ? (
                      <Moon className="h-5 w-5 text-slate-600" />
                    ) : (
                      <Sun className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Modo escuro</p>
                      <p className="text-xs text-slate-500">Reduz o brilho da tela em ambientes com pouca luz.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={darkMode}
                    onClick={toggleDarkMode}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 rounded-full transition',
                      darkMode ? 'bg-primary-600' : 'bg-slate-300'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition',
                        darkMode ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </SettingsGroupPanel>
            )}
          </div>
        </div>
    </div>
  );
}
