import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { chartPeriodSchema } from './dashboard.dto';
import { getChartPeriodConfig } from './chartPeriod';
import { memoryCache, CACHE_KEYS } from '../../shared/cache/memoryCache';

interface BelowMinRow {
  id: string;
  name: string;
  internalCode: string;
  minQuantity: number;
  category: string;
  current: number;
}

interface ChartRow {
  bucket: string;
  entries: number;
  exits: number;
}

export class DashboardService {
  static async getEntriesExitsChart(periodParam?: string) {
    const period = chartPeriodSchema.catch('month').parse(periodParam ?? 'month');
    const { start, groupBy, buckets } = getChartPeriodConfig(period);

    const bucketExpr =
      groupBy === 'hour'
        ? Prisma.sql`'h' || EXTRACT(HOUR FROM "movementDate")::int`
        : groupBy === 'day'
          ? Prisma.sql`to_char("movementDate", 'YYYY-MM-DD')`
          : Prisma.sql`to_char("movementDate", 'YYYY-MM')`;

    const rows = await prisma.$queryRaw<ChartRow[]>(Prisma.sql`
      SELECT ${bucketExpr} AS bucket,
        COALESCE(SUM(CASE WHEN "type" IN ('ENTRADA_COMPRA','ENTRADA_MANUAL','AJUSTE_ENTRADA','DEVOLUCAO') THEN quantity ELSE 0 END), 0)::int AS entries,
        COALESCE(SUM(CASE WHEN "type" NOT IN ('ENTRADA_COMPRA','ENTRADA_MANUAL','AJUSTE_ENTRADA','DEVOLUCAO','TRANSFERENCIA') THEN quantity ELSE 0 END), 0)::int AS exits
      FROM stock_movements
      WHERE "movementDate" >= ${start}
      GROUP BY bucket
    `);

    const entryMap = new Map(rows.map((r) => [r.bucket, r.entries]));
    const exitMap = new Map(rows.map((r) => [r.bucket, r.exits]));

    return {
      period,
      chartData: buckets.map((b) => ({
        date: b.label,
        entries: entryMap.get(b.key) ?? 0,
        exits: exitMap.get(b.key) ?? 0,
      })),
    };
  }

  static getMetrics() {
    return memoryCache.getOrSet(CACHE_KEYS.dashboardMetrics, 30_000, () =>
      this.computeMetrics()
    );
  }

  private static async computeMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalProducts,
      totalLocations,
      todayMovements,
      pendingTransfers,
      belowMin,
      expiringBatches,
    ] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.stockLocation.count({ where: { active: true } }),
      prisma.stockMovement.count({
        where: { movementDate: { gte: today, lt: tomorrow } },
      }),
      prisma.stockMovement.count({
        where: { status: 'PENDENTE' },
      }),
      prisma.$queryRaw<BelowMinRow[]>(Prisma.sql`
        SELECT p.id, p.name, p."internalCode" AS "internalCode", p."minQuantity" AS "minQuantity",
          c.name AS category,
          COALESCE(SUM(si.quantity), 0)::int AS current
        FROM products p
        JOIN categories c ON c.id = p."categoryId"
        LEFT JOIN stock_items si ON si."productId" = p.id
        WHERE p.active = true
        GROUP BY p.id, c.name
        HAVING COALESCE(SUM(si.quantity), 0) < p."minQuantity"
        ORDER BY p.name
      `),
      prisma.productBatch.findMany({
        where: {
          expirationDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
          quantity: { gt: 0 },
        },
        include: { product: true },
        orderBy: { expirationDate: 'asc' },
        take: 10,
      }),
    ]);

    const totalStockValue = await prisma.stockMovement.aggregate({
      where: {
        type: { in: ['ENTRADA_COMPRA', 'ENTRADA_MANUAL'] },
        movementDate: { gte: thirtyDaysAgo },
      },
      _sum: { totalValue: true },
    });

    const recentMovements = await prisma.stockMovement.findMany({
      take: 10,
      orderBy: { movementDate: 'desc' },
      include: {
        product: { select: { name: true, internalCode: true } },
        user: { select: { name: true } },
        originLocation: { select: { name: true } },
        destinationLocation: { select: { name: true } },
      },
    });

    return {
      kpis: {
        totalProducts,
        totalLocations,
        todayMovements,
        pendingTransfers,
        belowMinCount: belowMin.length,
        expiringCount: expiringBatches.length,
        monthlyEntryValue: totalStockValue._sum.totalValue || 0,
      },
      belowMin,
      expiring: expiringBatches,
      recentMovements,
    };
  }
}
