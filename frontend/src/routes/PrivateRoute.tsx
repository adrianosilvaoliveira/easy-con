import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { User } from '@/types';

export function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    api
      .get<{ success: boolean; data: User }>('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => {
        /* mantém sessão local se a sincronização falhar */
      });
  }, [isAuthenticated, accessToken, setUser]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}