import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { ExpirationBadge, ExpirationStatusType } from '@/components/expiration/ExpirationBadge';

interface AlertItem {
  id: string;
  alertType: string;
  visualized: boolean;
  batch: {
    batchNumber: string;
    status: ExpirationStatusType;
    product: { name: string };
    stockLocation: { name: string };
  };
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => api.get('/batches/alerts/count').then((r) => r.data.data.count as number),
    refetchInterval: 60_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-list'],
    queryFn: () =>
      api.get('/batches/alerts', { params: { visualized: 'false', limit: 10 } }).then((r) => r.data),
    enabled: open,
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/batches/alerts/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-count'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
    },
  });

  const alerts: AlertItem[] = alertsData?.data || [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative shrink-0 rounded-lg p-2 text-slate-300 hover:bg-slate-700/60"
        aria-label="Alertas de vencimento"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,360px)] rounded-xl border border-surface-border bg-white shadow-elevated dark:border-slate-600 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 dark:border-slate-600">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Alertas de Vencimento</h3>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  className="text-xs text-primary-600 hover:underline dark:text-primary-400"
                >
                  Marcar todas lidas
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum alerta pendente</p>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className="border-b border-surface-border px-4 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{a.batch.product.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Lote {a.batch.batchNumber} · {a.batch.stockLocation.name}
                        </p>
                      </div>
                      <ExpirationBadge status={a.batch.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-surface-border p-2 dark:border-slate-600">
              <Link
                to="/vencimentos"
                onClick={() => setOpen(false)}
                className="block rounded-lg py-2 text-center text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-700"
              >
                Ver todos os vencimentos
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
