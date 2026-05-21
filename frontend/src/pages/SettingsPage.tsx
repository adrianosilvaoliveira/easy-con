import { PageHeader } from '@/components/ui/PageHeader';
import { useAuthStore } from '@/stores/authStore';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="page-content">
      <PageHeader title="Configurações" />

      <div className="card max-w-xl">
        <h2 className="font-semibold text-slate-900">Sua conta</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Nome</dt>
            <dd className="font-medium">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">E-mail</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Perfil</dt>
            <dd className="font-medium">{user?.role}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
