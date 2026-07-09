import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { PrivateRoute } from './PrivateRoute';
import { PermissionRoute } from './PermissionRoute';
import { ROUTE_PERMISSIONS } from './routePermissions';
import { LoginPage } from '@/pages/LoginPage';
import { RouteFallback } from '@/components/ui/RouteFallback';
import { RouteErrorBoundary } from '@/components/ui/RouteErrorBoundary';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ProductsPage = lazy(() =>
  import('@/pages/ProductsPage').then((m) => ({ default: m.ProductsPage }))
);
const StockPage = lazy(() => import('@/pages/StockPage').then((m) => ({ default: m.StockPage })));
const EntriesPage = lazy(() =>
  import('@/pages/EntriesPage').then((m) => ({ default: m.EntriesPage }))
);
const ExitsPage = lazy(() => import('@/pages/ExitsPage').then((m) => ({ default: m.ExitsPage })));
const TransfersPage = lazy(() =>
  import('@/pages/TransfersPage').then((m) => ({ default: m.TransfersPage }))
);
const InventoryPage = lazy(() =>
  import('@/pages/InventoryPage').then((m) => ({ default: m.InventoryPage }))
);
const ReportsPage = lazy(() =>
  import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const CadastrosPage = lazy(() =>
  import('@/pages/CadastrosPage').then((m) => ({ default: m.CadastrosPage }))
);
const ExpirationsPage = lazy(() =>
  import('@/pages/ExpirationsPage').then((m) => ({ default: m.ExpirationsPage }))
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateRoute />}>
        <Route element={<MainLayout />}>
          <Route
            element={
              <RouteErrorBoundary>
                <Suspense fallback={<RouteFallback />}>
                  <Outlet />
                </Suspense>
              </RouteErrorBoundary>
            }
          >
            <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.dashboard} />}>
              <Route index element={<DashboardPage />} />
            </Route>
            <Route path="cadastros" element={<CadastrosPage />} />
            <Route path="produtos" element={<ProductsPage />} />
            <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.estoque} />}>
              <Route path="estoque" element={<StockPage />} />
            </Route>
            <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.entradas} />}>
              <Route path="entradas" element={<EntriesPage />} />
            </Route>
            <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.saidas} />}>
              <Route path="saidas" element={<ExitsPage />} />
            </Route>
            <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.transferencias} />}>
              <Route path="transferencias" element={<TransfersPage />} />
            </Route>
            <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.inventario} />}>
              <Route path="inventario" element={<InventoryPage />} />
            </Route>
            <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.vencimentos} />}>
              <Route path="vencimentos" element={<ExpirationsPage />} />
            </Route>
            <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.relatorios} />}>
              <Route path="relatorios" element={<ReportsPage />} />
            </Route>
            <Route path="usuarios" element={<Navigate to="/configuracoes/usuarios" replace />} />
            <Route path="configuracoes/*" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
