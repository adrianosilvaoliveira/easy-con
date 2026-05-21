import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  cadastros: 'Cadastros',
  produtos: 'Produtos',
  estoque: 'Estoque',
  entradas: 'Entradas',
  saidas: 'Saídas',
  transferencias: 'Transferências',
  inventario: 'Inventário',
  vencimentos: 'Vencimentos',
  relatorios: 'Relatórios',
  usuarios: 'Usuários',
  configuracoes: 'Configurações',
};

interface PageHeaderProps {
  title: string;
  action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
      <nav
        className="flex min-w-0 flex-wrap items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300"
        aria-label="Navegação da página"
      >
        <Link
          to="/"
          className="flex shrink-0 items-center rounded p-0.5 text-slate-500 hover:text-primary-600"
          aria-label="Início"
        >
          <Home className="h-4 w-4" />
        </Link>
        {segments.map((seg, i) => {
          const path = '/' + segments.slice(0, i + 1).join('/');
          const isLast = i === segments.length - 1;
          const label = routeLabels[seg] || seg;
          return (
            <span key={path} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              {isLast ? (
                <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                  {title}
                </h1>
              ) : (
                <Link to={path} className="truncate hover:text-primary-600">
                  {label}
                </Link>
              )}
            </span>
          );
        })}
        {segments.length === 0 && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</h1>
          </>
        )}
      </nav>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
