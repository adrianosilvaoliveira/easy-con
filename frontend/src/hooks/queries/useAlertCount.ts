import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

/** Contador de alertas de vencimento para o sino de notificações. */
export function useAlertCount() {
  return useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => api.get('/batches/alerts/count').then((r) => r.data.data.count as number),
    // 5 min: reduz ops Prisma (auth + count) sem prejudicar o uso do sino.
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}
