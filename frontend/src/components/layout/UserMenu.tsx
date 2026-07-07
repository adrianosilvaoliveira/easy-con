import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useClickOutside } from '@/hooks/useClickOutside';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { getRoleLabel } from '@/constants/roles';
import api from '@/services/api';

interface UserMenuProps {
  /** Estilo do botão no menu superior escuro */
  triggerClassName?: string;
}

export function UserMenu({ triggerClassName }: UserMenuProps) {
  const { user, logout, refreshToken } = useAuthStore();
  const darkMode = useThemeStore((s) => s.darkMode);
  const toggleDarkMode = useThemeStore((s) => s.toggleDarkMode);
  const avatarUrl = user?.avatarUrl;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setOpen(false), open);

  if (!user) return null;

  const handleLogout = async () => {
    setOpen(false);
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded-full transition focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-[#1E293B]',
          triggerClassName
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu da conta"
      >
        <UserAvatar name={user.name} imageUrl={avatarUrl} size="md" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white py-1 shadow-elevated dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <UserAvatar name={user.name} imageUrl={avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {user.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                <p className="truncate text-xs text-primary-600 dark:text-primary-400">
                  {getRoleLabel(user.role)}
                </p>
              </div>
            </div>
          </div>

          <div className="px-2 py-1">
            <Link
              to="/configuracoes"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
            >
              <User className="h-4 w-4 shrink-0 text-slate-500" />
              Minha conta
            </Link>
            <Link
              to="/configuracoes"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
            >
              <Settings className="h-4 w-4 shrink-0 text-slate-500" />
              Configurações
            </Link>
          </div>

          <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                {darkMode ? (
                  <Moon className="h-4 w-4 text-slate-500" />
                ) : (
                  <Sun className="h-4 w-4 text-slate-500" />
                )}
                <span>Modo escuro</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                onClick={toggleDarkMode}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 rounded-full transition',
                  darkMode ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
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
          </div>

          <div className="border-t border-slate-100 px-2 py-1 dark:border-slate-700">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
