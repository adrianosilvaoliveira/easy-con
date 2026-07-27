import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { User } from '@/types';

export function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  // Só sincroniza perfil no login/mount — não a cada refresh de accessToken (15m).
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    api
      .get<{ success: boolean; data: User }>('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => {
        /* mantém sessão local se a sincronização falhar */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita /auth/me a cada refresh JWT
  }, [isAuthenticated, setUser]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}