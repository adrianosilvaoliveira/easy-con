import { prisma } from '../../database/prisma';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { Prisma } from '@prisma/client';
import { memoryCache, CACHE_KEYS } from '../../shared/cache/memoryCache';

const HISTORY_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

export type AlertListStatus = 'active' | 'history' | 'snoozed';

export class AlertService {
  static historySince(): Date {
    return new Date(Date.now() - HISTORY_RETENTION_MS);
  }

  /** Alertas que exigem atenção agora (não lidos e não adiados) */
  static activeWhere(): Prisma.ExpirationAlertWhereInput {
    const now = new Date();
    return {
      visualized: false,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
    };
  }

  static snoozedWhere(): Prisma.ExpirationAlertWhereInput {
    return {
      visualized: false,
      snoozedUntil: { gt: new Date() },
    };
  }

  static historyWhere(search?: string): Prisma.ExpirationAlertWhereInput {
    const since = this.historySince();
    const where: Prisma.ExpirationAlertWhereInput = {
      visualized: true,
      visualizedAt: { gte: since },
    };
    const q = search?.trim();
    if (q) {
      where.OR = [
        { batch: { product: { name: { contains: q, mode: 'insensitive' } } } },
        { batch: { batchNumber: { contains: q, mode: 'insensitive' } } },
        { batch: { stockLocation: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  static async list(filters: {
    page?: string;
    limit?: string;
    status?: string;
    search?: string;
    /** legado */
    visualized?: string;
  }) {
    const pagination = parsePagination(filters.page, filters.limit);
    let where: Prisma.ExpirationAlertWhereInput;

    if (filters.visualized === 'false') {
      where = this.activeWhere();
    } else if (filters.visualized === 'true') {
      where = this.historyWhere(filters.search);
    } else {
      const status = (filters.status || 'active') as AlertListStatus;
      if (status === 'history') where = this.historyWhere(filters.search);
      else if (status === 'snoozed') where = this.snoozedWhere();
      else where = this.activeWhere();
    }

    const [data, total] = await Promise.all([
      prisma.expirationAlert.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy:
          filters.status === 'history' || filters.visualized === 'true'
            ? { visualizedAt: 'desc' }
            : { alertDate: 'desc' },
        include: {
          batch: {
            include: {
              product: { select: { id: true, name: true, internalCode: true } },
              stockLocation: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      prisma.expirationAlert.count({ where }),
    ]);

    return buildPaginatedResult(data, total, pagination);
  }

  static async countActive() {
    return memoryCache.getOrSet(CACHE_KEYS.alertCount, 30_000, () =>
      prisma.expirationAlert.count({ where: this.activeWhere() })
    );
  }

  /** @deprecated use countActive */
  static async countUnvisualized() {
    return this.countActive();
  }

  static async markVisualized(id: string) {
    const result = await prisma.expirationAlert.update({
      where: { id },
      data: {
        visualized: true,
        visualizedAt: new Date(),
        snoozedUntil: null,
      },
    });
    memoryCache.invalidate(CACHE_KEYS.alertCount);
    return result;
  }

  static async snooze(id: string, until: Date) {
    const result = await prisma.expirationAlert.update({
      where: { id },
      data: {
        snoozedUntil: until,
        visualized: false,
        visualizedAt: null,
      },
    });
    memoryCache.invalidate(CACHE_KEYS.alertCount);
    return result;
  }

  static snoozeUntilFromPreset(preset: string): Date {
    const now = Date.now();
    const hours: Record<string, number> = {
      '4h': 4,
      '1d': 24,
      '3d': 72,
      '7d': 168,
    };
    const h = hours[preset] ?? 24;
    return new Date(now + h * 60 * 60 * 1000);
  }

  static async markAllVisualized() {
    const now = new Date();
    const result = await prisma.expirationAlert.updateMany({
      where: this.activeWhere(),
      data: {
        visualized: true,
        visualizedAt: now,
        snoozedUntil: null,
      },
    });
    memoryCache.invalidate(CACHE_KEYS.alertCount);
    return { updated: result.count };
  }

  /** Remove histórico com mais de 1 ano */
  static async purgeOldHistory() {
    const cutoff = this.historySince();
    const result = await prisma.expirationAlert.deleteMany({
      where: {
        visualized: true,
        visualizedAt: { lt: cutoff },
      },
    });
    return { deleted: result.count };
  }
}
