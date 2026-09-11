import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface PermissionRouteProps {
  /** Uma permissão basta (ex.: dashboard:READ) */
  permission: string;
}

export function PermissionRoute({ permission }: PermissionRouteProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(permission)) {
    if (location.pathname === '/' || location.pathname === '') {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-4 text-center text-sm text-slate-600 dark:text-slate-300">
          Sem permissão para o dashboard. Abra o menu ou faça login com outro usuário.
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
