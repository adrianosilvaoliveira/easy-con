/**
 * Chaves de query centralizadas para o TanStack Query.
 * Evita fragmentação de cache (ex.: `['locations']` vs `['stock-locations']`)
 * e garante invalidação consistente entre páginas.
 */
export const queryKeys = {
  stockLocations: ['stock', 'locations'] as const,
  stockItems: (params: unknown) => ['stock', 'items', params] as const,
  dashboard: {
    metrics: ['dashboard', 'metrics'] as const,
    chart: (period: string) => ['dashboard', 'chart', period] as const,
  },
  alertCount: ['batches', 'alerts', 'count'] as const,
} as const;
