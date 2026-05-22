import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { PrivateRoute } from './PrivateRoute';
import { PermissionRoute } from './PermissionRoute';
import { ROUTE_PERMISSIONS } from './routePermissions';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { StockPage } from '@/pages/StockPage';
import { EntriesPage } from '@/pages/EntriesPage';
import { ExitsPage } from '@/pages/ExitsPage';
import { TransfersPage } from '@/pages/TransfersPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CadastrosPage } from '@/pages/CadastrosPage';
import { ExpirationsPage } from '@/pages/ExpirationsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateRoute />}>
        <Route element={<MainLayout />}>
          <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.dashboard} />}>
            <Route index element={<DashboardPage />} />
          </Route>
          <Route element={<PermissionRoute permission={ROUTE_PERMISSIONS.cadastros} />}>
            <Route path="cadastros" element={<CadastrosPage />} />
          </Route>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
