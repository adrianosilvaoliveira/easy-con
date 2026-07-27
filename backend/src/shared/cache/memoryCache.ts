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

  get<T>(key: string): T | undefined {
    const cached = this.store.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      if (cached) this.store.delete(key);
      return undefined;
    }
    return cached.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}

export const memoryCache = new MemoryCache();

/** TTL do snapshot de auth (pv/active) — reduz 1 query Prisma por request autenticada. */
export const AUTH_ACCOUNT_TTL_MS = 60_000;

export const CACHE_KEYS = {
  dashboardMetrics: 'dashboard:metrics',
  alertCount: 'alerts:count',
  authUser: (userId: string) => `auth:user:${userId}`,
} as const;
