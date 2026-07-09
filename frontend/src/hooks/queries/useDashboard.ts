import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { DashboardMetrics, EntriesExitsChartData } from '@/types';

/** Indicadores principais do dashboard (KPIs, estoque mínimo, vencendo, recentes). */
export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<{ data: DashboardMetrics }>('/dashboard').then((r) => r.data.data),
    staleTime: 2 * 60_000,
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403 || status === 503) return false;
      return failureCount < 1;
    },
  });
}

/** Série de entradas x saídas para o período selecionado. */
export function useDashboardChart(period: string) {
  return useQuery({
    queryKey: ['dashboard', 'entries-exits-chart', period],
    queryFn: () =>
      api
        .get<{ data: EntriesExitsChartData }>('/dashboard/entries-exits-chart', {
          params: { period },
        })
        .then((r) => r.data.data),
    staleTime: 2 * 60_000,
  });
}

/** Métricas do módulo de vencimentos (contadores, perda financeira, lotes críticos). */
export function useBatchesDashboard() {
  return useQuery({
    queryKey: ['batches-dashboard'],
    queryFn: () => api.get('/batches/dashboard').then((r) => r.data.data),
    staleTime: 2 * 60_000,
  });
}
