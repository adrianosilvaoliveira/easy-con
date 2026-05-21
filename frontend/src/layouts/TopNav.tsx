import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Library,
  Package,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ClipboardList,
  CalendarClock,
  FileText,
  Users,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AppLogo } from '@/components/ui/AppLogo';
import { ROUTE_PERMISSIONS } from '@/routes/routePermissions';
import { UserMenu } from '@/components/layout/UserMenu';

// < 1024px → drawer | 1024–1279px → ícones | ≥ 1280px → texto em linha única

const navItems = [
  { to: '/', label: 'Dashboard', shortLabel: 'Início', icon: LayoutDashboard, permission: ROUTE_PERMISSIONS.dashboard },
  { to: '/cadastros', label: 'Cadastros', shortLabel: 'Cadast.', icon: Library, permission: ROUTE_PERMISSIONS.cadastros },
  { to: '/estoque', label: 'Estoque', shortLabel: 'Estoque', icon: Boxes, permission: ROUTE_PERMISSIONS.estoque },
  { to: '/produtos', label: 'Produtos', shortLabel: 'Produtos', icon: Package, permission: ROUTE_PERMISSIONS.produtos },
  { to: '/entradas', label: 'Entradas', shortLabel: 'Entradas', icon: ArrowDownToLine, permission: ROUTE_PERMISSIONS.entradas },
  { to: '/saidas', label: 'Saídas', shortLabel: 'Saídas', icon: ArrowUpFromLine, permission: ROUTE_PERMISSIONS.saidas },
  { to: '/transferencias', label: 'Transferências', shortLabel: 'Transf.', icon: ArrowLeftRight, permission: ROUTE_PERMISSIONS.transferencias },
  { to: '/inventario', label: 'Inventário', shortLabel: 'Invent.', icon: ClipboardList, permission: ROUTE_PERMISSIONS.inventario },
  { to: '/vencimentos', label: 'Vencimentos', shortLabel: 'Vencim.', icon: CalendarClock, permission: ROUTE_PERMISSIONS.vencimentos },
  { to: '/relatorios', label: 'Relatórios', shortLabel: 'Relat.', icon: FileText, permission: ROUTE_PERMISSIONS.relatorios },
  { to: '/usuarios', label: 'Usuários', shortLabel: 'Usuários', icon: Users, permission: ROUTE_PERMISSIONS.usuarios },
];

function NavItem({
  to,
  label,
  shortLabel,
  icon: Icon,
  end,
  onClick,
  mode = 'full',
  variant = 'light',
}: {
  to: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  end?: boolean;
  onClick?: () => void;
  mode?: 'icon' | 'compact' | 'full';
  variant?: 'light' | 'dark';
}) {
  const displayLabel = mode === 'compact' ? shortLabel : label;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={mode !== 'full' ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex min-w-0 items-center rounded-md font-medium transition',
          mode === 'icon' && 'shrink-0 justify-center p-2',
          mode === 'compact' &&
            'flex-1 basis-0 justify-center gap-1 px-1 py-1.5 text-[11px] leading-tight xl:gap-1.5 xl:px-1.5 xl:text-xs',
          mode === 'full' &&
            'flex-1 basis-0 justify-center gap-1.5 px-2 py-1.5 text-xs xl:gap-2 xl:px-2.5 xl:text-sm',
          isActive
            ? variant === 'dark'
              ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-600'
              : 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-100'
            : variant === 'dark'
              ? 'text-slate-300 hover:bg-slate-700/80 hover:text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )
      }
    >
      <Icon
        className={cn(
          'shrink-0',
          mode === 'icon' ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5 xl:h-4 xl:w-4'
        )}
      />
      {mode !== 'icon' && (
        <span className="truncate text-center">{displayLabel}</span>
      )}
    </NavLink>
  );
}

export function TopNav() {
  const { hasPermission } = useAuthStore();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isNavText = useMediaQuery('(min-width: 1280px)');
  const isNavFull = useMediaQuery('(min-width: 1536px)');

  const showDrawer = !isDesktop;
  const navMode: 'icon' | 'compact' | 'full' = !isNavText ? 'icon' : isNavFull ? 'full' : 'compact';

  const visibleItems = navItems.filter((item) => hasPermission(item.permission));

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-[100vw] border-b border-slate-700 bg-[#1E293B]">
        <div className="grid h-14 w-full min-w-0 grid-cols-[auto_1fr_auto] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5 lg:px-6 xl:px-8">
          {/* Marca */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            {showDrawer && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="shrink-0 rounded-lg p-2 text-slate-300 hover:bg-slate-700/80 hover:text-white"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <AppLogo size="md" />
          </div>

          {/* Navegação — uma linha, distribuição uniforme */}
          {isDesktop && (
            <nav
              className={cn(
                'flex min-w-0 flex-1 flex-nowrap items-center',
                navMode === 'icon'
                  ? 'justify-center gap-0.5'
                  : 'justify-stretch gap-px px-0.5 xl:gap-0.5'
              )}
              aria-label="Menu principal"
            >
              {visibleItems.map(({ to, label, shortLabel, icon }) => (
                <NavItem
                  key={to}
                  to={to}
                  label={label}
                  shortLabel={shortLabel}
                  icon={icon}
                  end={to === '/'}
                  mode={navMode}
                  variant="dark"
                />
              ))}
            </nav>
          )}

          <div className="flex shrink-0 items-center justify-end">
            <UserMenu />
          </div>
        </div>
      </header>

      {menuOpen && showDrawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(100vw-3rem,300px)] flex-col bg-white shadow-elevated dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 border-b border-surface-border px-4 py-4 dark:border-slate-700">
              <AppLogo size="md" />
              <div className="flex items-center gap-2">
                <UserMenu />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto overscroll-contain p-3">
              <div className="flex flex-col gap-0.5">
                {visibleItems.map(({ to, label, shortLabel, icon }) => (
                  <NavItem
                    key={to}
                    to={to}
                    label={label}
                    shortLabel={shortLabel}
                    icon={icon}
                    end={to === '/'}
                    mode="full"
                    onClick={() => setMenuOpen(false)}
                  />
                ))}
              </div>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
