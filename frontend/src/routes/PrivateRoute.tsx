import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import type { User } from '@/types';
import { RouteFallback } from '@/components/ui/RouteFallback';

export function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !accessToken) {
      setProfileReady(true);
      return;
    }

    let cancelled = false;
    api
      .get<{ success: boolean; data: User }>('/auth/me')
      .then((res) => {
        const profile = res.data?.data;
        if (profile?.id) {
          setUser(profile);
          return;
        }
        if (!useAuthStore.getState().user) logout();
      })
      .catch(() => {
        if (!cancelled && !useAuthStore.getState().user) logout();
      })
      .finally(() => {
        if (!cancelled) setProfileReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated, accessToken, setUser, logout]);

  if (!hydrated || (isAuthenticated && !user && !profileReady)) {
    return <RouteFallback />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
