interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Cache em memória com TTL curto. Em serverless (Vercel) vive por instância quente,
 * portanto é uma otimização de burst — não uma garantia de consistência global.
 * A camada de cache principal do app continua sendo o TanStack Query no frontend.
 */
class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    const value = await loader();
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}

export const memoryCache = new MemoryCache();

export const CACHE_KEYS = {
  dashboardMetrics: 'dashboard:metrics',
  alertCount: 'alerts:count',
} as const;
