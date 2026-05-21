import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface PermissionRouteProps {
  /** Uma permissão basta (ex.: dashboard:READ) */
  permission: string;
}

export function PermissionRoute({ permission }: PermissionRouteProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
