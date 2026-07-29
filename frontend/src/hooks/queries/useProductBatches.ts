import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export type ProductBatchOption = {
  id: string;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  status?: string;
  location?: { id: string; name: string; code: string };
};

export function useProductBatches(productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['product-batches', productId],
    queryFn: () =>
      api.get(`/products/${productId}/batches`).then(
        (r) =>
          r.data.data as {
            hasLots: boolean;
            batches: ProductBatchOption[];
          }
      ),
    enabled: enabled && !!productId,
    staleTime: 30_000,
  });
}
