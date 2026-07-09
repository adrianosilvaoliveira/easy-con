import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import type { StockLocation } from '@/types';

/** Fonte única para os locais de estoque, com chave de cache padronizada. */
export function useLocations() {
  return useQuery({
    queryKey: queryKeys.stockLocations,
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data as StockLocation[]),
    staleTime: 5 * 60_000,
  });
}
