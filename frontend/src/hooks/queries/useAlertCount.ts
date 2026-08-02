import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

/** Contador de alertas de vencimento para o sino de notificações. */
export function useAlertCount() {
  return useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => api.get('/batches/alerts/count').then((r) => r.data.data.count as number),
    // 10 min: sino não precisa de tempo real; cache server + UI cobrem o intervalo.
    refetchInterval: 10 * 60_000,
    staleTime: 10 * 60_000,
    refetchIntervalInBackground: false,
  });
}
