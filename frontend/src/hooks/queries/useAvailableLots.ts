import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { StockItem } from '@/types';

export type AvailableLot = {
  batchId: string;
  batchNumber: string;
  expirationDate?: string;
  quantity: number;
  status?: string;
};

/**
 * Lotes com saldo > 0 para um produto em um local, ordenados por validade (FEFO).
 */
export function useAvailableLots(
  productId: string | undefined,
  locationId: string | undefined,
  enabled = true
) {
  const query = useQuery({
    queryKey: ['stock-items', 'available-lots', productId, locationId],
    queryFn: () =>
      api
        .get('/stock/items', {
          params: { productId, locationId, limit: 500 },
        })
        .then((r) => r.data.data as StockItem[]),
    enabled: enabled && !!productId && !!locationId,
  });

  const lots = useMemo<AvailableLot[]>(() => {
    if (!productId || !locationId) return [];
    return (query.data ?? [])
      .filter((item) => item.quantity > 0 && item.batch?.id)
      .map((item) => ({
        batchId: item.batch!.id,
        batchNumber: item.batch!.batchNumber,
        expirationDate: item.batch!.expirationDate,
        quantity: item.quantity,
        status: item.batch!.status,
      }))
      .sort((a, b) => {
        const da = a.expirationDate ? new Date(a.expirationDate).getTime() : Number.POSITIVE_INFINITY;
        const db = b.expirationDate ? new Date(b.expirationDate).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      });
  }, [query.data, productId, locationId]);

  return {
    lots,
    hasLots: lots.length > 0,
    hasMultipleLots: lots.length > 1,
    isLoading: query.isLoading || query.isFetching,
  };
}
