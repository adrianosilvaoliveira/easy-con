import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { StockItem } from '@/types';

export type StockOriginOption = {
  id: string;
  name: string;
  quantity: number;
};

/**
 * Locais com saldo > 0 do produto, agregando quantidade por local.
 */
export function useProductStockOrigins(productId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ['stock-items', 'product-origins', productId],
    queryFn: () =>
      api
        .get('/stock/items', { params: { productId, limit: 100 } })
        .then((r) => r.data.data as StockItem[]),
    enabled: enabled && !!productId,
  });

  const origins = useMemo<StockOriginOption[]>(() => {
    const byLocation = new Map<string, StockOriginOption>();
    for (const item of query.data ?? []) {
      if (item.quantity <= 0) continue;
      const existing = byLocation.get(item.location.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        byLocation.set(item.location.id, {
          id: item.location.id,
          name: item.location.name,
          quantity: item.quantity,
        });
      }
    }
    return [...byLocation.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return {
    origins,
    items: query.data ?? [],
    isLoading: query.isLoading || query.isFetching,
  };
}
