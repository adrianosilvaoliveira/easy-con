import { prisma } from '../../database/prisma';
import { chartPeriodSchema } from './dashboard.dto';
import { buildEntriesExitsChart, getChartPeriodConfig } from './chartPeriod';

export class DashboardService {
  static async getEntriesExitsChart(periodParam?: string) {
    const period = chartPeriodSchema.catch('month').parse(periodParam ?? 'month');
    const { start } = getChartPeriodConfig(period);

    const movements = await prisma.stockMovement.findMany({
      where: { movementDate: { gte: start } },
      select: { type: true, quantity: true, movementDate: true },
    });

    return {
      period,
      chartData: buildEntriesExitsChart(movements, period),
    };
  }

  static async getMetrics() {
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
      products,
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
      prisma.product.findMany({
        where: { active: true },
        include: { stockItems: true, category: true },
      }),
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

    const belowMin = products
      .filter((p) => p.stockItems.reduce((s, i) => s + i.quantity, 0) < p.minQuantity)
      .map((p) => ({
        id: p.id,
        name: p.name,
        internalCode: p.internalCode,
        minQuantity: p.minQuantity,
        current: p.stockItems.reduce((s, i) => s + i.quantity, 0),
        category: p.category.name,
      }));

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
