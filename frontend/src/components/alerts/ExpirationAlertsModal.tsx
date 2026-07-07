import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Check, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ExpirationBadge, ExpirationStatusType } from '@/components/expiration/ExpirationBadge';
import { EXPIRATION_ALERT_LABELS, SNOOZE_PRESETS } from '@/constants/expirationAlertLabels';
import { useAuthStore } from '@/stores/authStore';
import { formatDateTime, formatProductName } from '@/utils/format';
import { cn } from '@/utils/cn';

export interface ExpirationAlertRecord {
  id: string;
  alertType: string;
  alertDate: string;
  visualized: boolean;
  visualizedAt?: string | null;
  snoozedUntil?: string | null;
  batch: {
    batchNumber: string;
    status: ExpirationStatusType;
    expirationDate: string;
    product: { name: string; internalCode: string };
    stockLocation: { name: string };
  };
}

interface StockAdvisory {
  belowMin: { id: string; name: string; internalCode: string; minQuantity: number; current: number }[];
}

type TabId = 'active' | 'history';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExpirationAlertsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('active');
  const [historySearch, setHistorySearch] = useState('');
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.hasPermission('batches:UPDATE'));

  const { data: activeData, isLoading: loadingActive } = useQuery({
    queryKey: ['alerts-list', 'active'],
    queryFn: () =>
      api.get('/batches/alerts', { params: { status: 'active', limit: 100 } }).then((r) => r.data),
    enabled: open && tab === 'active',
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['alerts-list', 'history', historySearch],
    queryFn: () =>
      api
        .get('/batches/alerts', {
          params: { status: 'history', search: historySearch || undefined, limit: 50 },
        })
        .then((r) => r.data),
    enabled: open && tab === 'history',
  });

  const { data: stockAdvisory } = useQuery({
    queryKey: ['stock-advisory'],
    queryFn: () => api.get<{ data: StockAdvisory }>('/stock/alerts').then((r) => r.data.data),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts-count'] });
    queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
    queryClient.invalidateQueries({ queryKey: ['batches-dashboard'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/batches/alerts/${id}/read`),
    onSuccess: () => {
      invalidate();
      toast.success('Marcado como visto');
    },
    onError: () => toast.error('Não foi possível marcar como visto'),
  });

  const snooze = useMutation({
    mutationFn: ({ id, preset }: { id: string; preset: string }) =>
      api.patch(`/batches/alerts/${id}/snooze`, { preset }),
    onSuccess: () => {
      invalidate();
      toast.success('Lembrete adiado');
    },
    onError: () => toast.error('Não foi possível adiar o alerta'),
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/batches/alerts/read-all'),
    onSuccess: () => {
      invalidate();
      toast.success('Todos os alertas foram marcados como vistos');
    },
    onError: () => toast.error('Não foi possível marcar todos'),
  });

  const activeAlerts: ExpirationAlertRecord[] = activeData?.data ?? [];
  const historyAlerts: ExpirationAlertRecord[] = historyData?.data ?? [];
  const belowMin = stockAdvisory?.belowMin ?? [];
  const activeCount = activeAlerts.length + belowMin.length;

  return (
    <Modal open={open} onClose={onClose} title="Alertas e avisos" size="lg">
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-surface-border pb-2 dark:border-slate-600">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              tab === 'active'
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            Ativos
            {activeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">{activeCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              tab === 'history'
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            Histórico (1 ano)
          </button>
        </div>

        {tab === 'active' && (
          <>
            {canManage && activeAlerts.length > 0 && (
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
                  Marcar todos como vistos
                </Button>
              </div>
            )}

            {loadingActive ? (
              <p className="py-8 text-center text-sm text-slate-500">Carregando...</p>
            ) : belowMin.length === 0 && activeAlerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum alerta pendente no momento.
              </p>
            ) : (
              <ul className="max-h-[min(50vh,420px)] space-y-2 overflow-y-auto">
                {belowMin.map((p) => (
                  <li
                    key={`belowmin-${p.id}`}
                    className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                          {formatProductName(p.name)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Código {p.internalCode}
                        </p>
                        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          Estoque {p.current}/{p.minQuantity} un. abaixo do mínimo
                        </p>
                      </div>
                      <Badge variant={p.current === 0 ? 'danger' : 'warning'}>
                        {p.current === 0 ? 'Sem estoque' : 'Estoque baixo'}
                      </Badge>
                    </div>
                  </li>
                ))}
                {activeAlerts.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-surface-border p-3 dark:border-slate-600 dark:bg-slate-900/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{formatProductName(a.batch.product.name)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Lote {a.batch.batchNumber} · {a.batch.stockLocation.name}
                        </p>
                        <p className="mt-1 text-xs font-medium text-violet-700 dark:text-violet-300">
                          {EXPIRATION_ALERT_LABELS[a.alertType] ?? a.alertType}
                        </p>
                      </div>
                      <ExpirationBadge status={a.batch.status} />
                    </div>
                    {canManage && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => markRead.mutate(a.id)}
                          loading={markRead.isPending}
                        >
                          <Check className="h-3.5 w-3.5" /> Visto
                        </Button>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <select
                            className="input-field max-w-[10rem] py-1.5 text-xs"
                            defaultValue=""
                            onChange={(e) => {
                              const preset = e.target.value;
                              if (!preset) return;
                              snooze.mutate({ id: a.id, preset });
                              e.target.value = '';
                            }}
                          >
                            <option value="">Avisar mais tarde...</option>
                            {SNOOZE_PRESETS.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar produto, lote ou local..."
                className="input-field w-full pl-9"
              />
            </div>
            {loadingHistory ? (
              <p className="py-8 text-center text-sm text-slate-500">Carregando...</p>
            ) : historyAlerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum registro no histórico.
              </p>
            ) : (
              <ul className="max-h-[min(50vh,420px)] space-y-2 overflow-y-auto">
                {historyAlerts.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-surface-border bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-900/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{formatProductName(a.batch.product.name)}</p>
                        <p className="text-xs text-slate-500">
                          Lote {a.batch.batchNumber} · {EXPIRATION_ALERT_LABELS[a.alertType] ?? a.alertType}
                        </p>
                        {a.visualizedAt && (
                          <p className="mt-1 text-xs text-slate-400">
                            Visto em {formatDateTime(a.visualizedAt)}
                          </p>
                        )}
                      </div>
                      <ExpirationBadge status={a.batch.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-400">Histórico mantido por até 1 ano.</p>
          </>
        )}

        <div className="border-t border-surface-border pt-3 dark:border-slate-600">
          <Link
            to="/vencimentos"
            onClick={onClose}
            className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Ver módulo de vencimentos →
          </Link>
        </div>
      </div>
    </Modal>
  );
}
