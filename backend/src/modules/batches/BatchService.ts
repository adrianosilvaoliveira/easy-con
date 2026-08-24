import {
  ExpirationStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import {
  calculateExpirationStatus,
  daysUntilExpiration,
  getApplicableAlertTypes,
  validateExpirationDate,
  validateManufacturingBeforeExpiration,
} from '../../shared/utils/expiration';
import { AuditService } from '../../services/AuditService';
import { AlertService } from './AlertService';
import { CACHE_KEYS, memoryCache } from '../../shared/cache/memoryCache';
import { getPrismaErrorCode } from '../../shared/utils/prismaErrors';
import { z } from 'zod';
import { createBatchSchema, updateBatchSchema } from './batches.dto';

type CreateBatchDTO = z.infer<typeof createBatchSchema>;
type UpdateBatchDTO = z.infer<typeof updateBatchSchema>;

export class BatchService {
  private static startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private static enrichBatch<T extends { expirationDate: Date }>(batch: T) {
    return {
      ...batch,
      status: calculateExpirationStatus(batch.expirationDate),
      daysUntilExpiration: daysUntilExpiration(batch.expirationDate),
    };
  }

  private static expirationRangeForStatus(status: ExpirationStatus): Prisma.DateTimeFilter {
    const today = this.startOfToday();
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const in90 = new Date(today);
    in90.setDate(in90.getDate() + 90);

    switch (status) {
      case 'EXPIRED':
        return { lt: today };
      case 'CRITICAL':
        return { gte: today, lte: in30 };
      case 'WARNING':
        return { gt: in30, lte: in90 };
      default:
        return { gt: in90 };
    }
  }

  static buildWhere(filters: Record<string, string | undefined>): Prisma.ProductBatchWhereInput {
    const where: Prisma.ProductBatchWhereInput = {};

    if (filters.productId) where.productId = filters.productId;
    if (filters.stockLocationId) where.stockLocationId = filters.stockLocationId;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.batchNumber) where.batchNumber = { contains: filters.batchNumber, mode: 'insensitive' };
    if (filters.status) {
      where.expirationDate = this.expirationRangeForStatus(filters.status as ExpirationStatus);
    }
    const productWhere: Prisma.ProductWhereInput = {};
    if (filters.categoryId) productWhere.categoryId = filters.categoryId;
    if (filters.includeInactive !== 'true') productWhere.active = true;
    if (Object.keys(productWhere).length > 0) where.product = productWhere;

    if (filters.expirationFrom || filters.expirationTo) {
      where.expirationDate = {};
      if (filters.expirationFrom) where.expirationDate.gte = new Date(filters.expirationFrom);
      if (filters.expirationTo) where.expirationDate.lte = new Date(filters.expirationTo);
    }

    if (filters.expiringDays) {
      const today = this.startOfToday();
      const limit = new Date(today);
      limit.setDate(limit.getDate() + Number(filters.expiringDays));
      where.expirationDate = { gte: today, lte: limit };
    }

    if (filters.search) {
      where.OR = [
        { batchNumber: { contains: filters.search, mode: 'insensitive' } },
        { product: { name: { contains: filters.search, mode: 'insensitive' } } },
        { product: { internalCode: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  static readonly batchInclude = {
    product: { include: { category: true } },
    stockLocation: true,
    supplier: true,
    createdBy: { select: { id: true, name: true } },
    _count: { select: { movements: true, expirationAlerts: true } },
  } as const;

  static async list(filters: Record<string, string | undefined>) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where = this.buildWhere(filters);

    const [data, total] = await Promise.all([
      prisma.productBatch.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { expirationDate: 'asc' },
        include: this.batchInclude,
      }),
      prisma.productBatch.count({ where }),
    ]);

    return buildPaginatedResult(
      data.map((b) => this.enrichBatch(b)),
      total,
      pagination
    );
  }

  static async listExpiring(days = 90, filters: Record<string, string | undefined> = {}) {
    return this.list({ ...filters, expiringDays: String(days), page: filters.page, limit: filters.limit });
  }

  static async listExpired(filters: Record<string, string | undefined> = {}) {
    const pagination = parsePagination(filters.page, filters.limit);
    const baseWhere = this.buildWhere(filters);
    delete (baseWhere as { status?: unknown }).status;
    const where: Prisma.ProductBatchWhereInput = {
      ...baseWhere,
      expirationDate: { lt: this.startOfToday() },
    };

    const [data, total] = await Promise.all([
      prisma.productBatch.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { expirationDate: 'asc' },
        include: this.batchInclude,
      }),
      prisma.productBatch.count({ where }),
    ]);

    return buildPaginatedResult(data.map((b) => this.enrichBatch(b)), total, pagination);
  }

  static async findById(id: string) {
    const batch = await prisma.productBatch.findUnique({
      where: { id },
      include: {
        ...this.batchInclude,
        movements: {
          take: 20,
          orderBy: { movementDate: 'desc' },
          include: { user: { select: { name: true } } },
        },
        expirationAlerts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!batch) throw new NotFoundError('Lote não encontrado');
    return this.enrichBatch(batch);
  }

  static async create(data: CreateBatchDTO, userId: string) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true, active: true },
    });
    if (!product) throw new NotFoundError('Produto não encontrado');
    if (!product.active) {
      throw new ValidationError('Produto inativo não pode receber lote');
    }

    const expirationDate = new Date(data.expirationDate);
    const manufacturingDate = data.manufacturingDate ? new Date(data.manufacturingDate) : null;

    try {
      validateExpirationDate(expirationDate, manufacturingDate);
    } catch (e) {
      throw new ValidationError((e as Error).message);
    }

    const status = calculateExpirationStatus(expirationDate);

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.productBatch.create({
        data: {
          productId: data.productId,
          stockLocationId: data.stockLocationId,
          batchNumber: data.batchNumber,
          expirationDate,
          manufacturingDate,
          quantity: data.quantity,
          supplierId: data.supplierId,
          unitCost: data.unitCost ? new Prisma.Decimal(data.unitCost) : undefined,
          status,
          createdById: userId,
        },
        include: this.batchInclude,
      });

      if (data.quantity > 0) {
        await tx.stockItem.upsert({
          where: {
            productId_locationId_batchId: {
              productId: data.productId,
              locationId: data.stockLocationId,
              batchId: created.id,
            },
          },
          create: {
            productId: data.productId,
            locationId: data.stockLocationId,
            batchId: created.id,
            quantity: data.quantity,
          },
          update: { quantity: { increment: data.quantity } },
        });
      }

      return created;
    });

    await AuditService.log({
      userId,
      action: 'CREATE_BATCH',
      module: 'batches',
      entityId: batch.id,
      entityType: 'ProductBatch',
      details: { batchNumber: batch.batchNumber, expirationDate: batch.expirationDate },
    });

    await this.syncBatchAlerts(batch.id);
    return batch;
  }

  static async update(id: string, data: UpdateBatchDTO, userId: string) {
    const existing = await this.findById(id);
    const expirationDate = data.expirationDate ? new Date(data.expirationDate) : existing.expirationDate;
    const manufacturingDate =
      data.manufacturingDate !== undefined
        ? data.manufacturingDate
          ? new Date(data.manufacturingDate)
          : null
        : existing.manufacturingDate;

    if (data.expirationDate || data.manufacturingDate !== undefined) {
      try {
        validateManufacturingBeforeExpiration(expirationDate, manufacturingDate);
      } catch (e) {
        throw new ValidationError((e as Error).message);
      }
    }

    const batch = await prisma.productBatch.update({
      where: { id },
      data: {
        batchNumber: data.batchNumber,
        expirationDate: data.expirationDate ? expirationDate : undefined,
        manufacturingDate: data.manufacturingDate !== undefined ? manufacturingDate : undefined,
        supplierId: data.supplierId,
        unitCost: data.unitCost !== undefined ? new Prisma.Decimal(data.unitCost) : undefined,
        status: calculateExpirationStatus(expirationDate),
        quantity: data.quantity,
      },
      include: this.batchInclude,
    });

    await AuditService.log({
      userId,
      action: 'UPDATE_BATCH',
      module: 'batches',
      entityId: id,
      details: data,
    });

    await this.syncBatchAlerts(id);
    return batch;
  }

  static async delete(id: string, userId: string) {
    const batch = await prisma.productBatch.findUnique({
      where: { id },
      include: { _count: { select: { movements: true } } },
    });
    if (!batch) throw new NotFoundError('Lote não encontrado');
    if (batch._count.movements > 0) {
      throw new ValidationError('Não é permitido excluir lote com movimentações');
    }
    if (batch.quantity > 0) {
      throw new ValidationError('Não é permitido excluir lote com saldo em estoque');
    }

    await prisma.productBatch.delete({ where: { id } });
    await AuditService.log({
      userId,
      action: 'DELETE_BATCH',
      module: 'batches',
      entityId: id,
    });
    return { message: 'Lote excluído' };
  }

  static async syncBatchQuantity(batchId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const sum = await db.stockItem.aggregate({
      where: { batchId },
      _sum: { quantity: true },
    });
    const qty = sum._sum.quantity || 0;
    await db.productBatch.update({
      where: { id: batchId },
      data: { quantity: qty },
    });
    return qty;
  }

  static async syncBatchAlerts(batchId: string) {
    const batch = await prisma.productBatch.findUnique({ where: { id: batchId } });
    if (!batch) return;

    const status = calculateExpirationStatus(batch.expirationDate);
    await prisma.productBatch.update({ where: { id: batchId }, data: { status } });

    if (batch.quantity <= 0) return;

    const types = getApplicableAlertTypes(batch.expirationDate);
    if (types.length === 0) return;

    // Uma operação em vez de N upserts + N audits (cron cobre atualização periódica).
    await prisma.expirationAlert.createMany({
      data: types.map((alertType) => ({ batchId, alertType })),
      skipDuplicates: true,
    });
    memoryCache.invalidate(CACHE_KEYS.alertCount);
  }

  static async getDashboardMetrics() {
    const today = this.startOfToday();
    const day = 24 * 60 * 60 * 1000;
    const t31 = new Date(today.getTime() + 31 * day);
    const t91 = new Date(today.getTime() + 91 * day);
    const in6Months = new Date(today);
    in6Months.setMonth(in6Months.getMonth() + 6);

    type CountRow = {
      expired: number;
      critical: number;
      warning: number;
      valid: number;
      financial_loss: number;
    };
    type MonthRow = { month: string; count: number };

    const [alertsCount, countRows, monthRows, criticalBatchesRaw] = await Promise.all([
      AlertService.countActive(),
      prisma.$queryRaw<CountRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE expiration_date < ${today})::int AS expired,
          COUNT(*) FILTER (WHERE expiration_date >= ${today} AND expiration_date < ${t31})::int AS critical,
          COUNT(*) FILTER (WHERE expiration_date >= ${t31} AND expiration_date < ${t91})::int AS warning,
          COUNT(*) FILTER (WHERE expiration_date >= ${t91})::int AS valid,
          COALESCE(SUM(CASE WHEN expiration_date < ${today}
            THEN quantity * COALESCE(unit_cost, 0) ELSE 0 END), 0)::float AS financial_loss
        FROM product_batches
      `,
      prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', expiration_date), 'YYYY-MM') AS month,
          COALESCE(SUM(quantity), 0)::int AS count
        FROM product_batches
        WHERE expiration_date >= ${today}
          AND expiration_date < ${in6Months}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.productBatch.findMany({
        where: { expirationDate: { lte: new Date(today.getTime() + 30 * day) } },
        take: 20,
        orderBy: { expirationDate: 'asc' },
        include: {
          product: { select: { name: true, internalCode: true } },
          stockLocation: { select: { name: true } },
        },
      }),
    ]);

    const counts = {
      expired: countRows[0]?.expired ?? 0,
      critical: countRows[0]?.critical ?? 0,
      warning: countRows[0]?.warning ?? 0,
      valid: countRows[0]?.valid ?? 0,
      alertsCount,
    };

    const monthMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }
    for (const row of monthRows) {
      if (monthMap.has(row.month)) monthMap.set(row.month, row.count);
    }

    const expiringByMonth = Array.from(monthMap.entries()).map(([month, count]) => ({
      month,
      count,
    }));

    const criticalBatches = criticalBatchesRaw
      .map((b) => this.enrichBatch(b))
      .filter((b) => b.status === 'CRITICAL' || b.status === 'EXPIRED')
      .slice(0, 10);

    return {
      counts,
      financialLoss: countRows[0]?.financial_loss ?? 0,
      expiringByMonth,
      criticalBatches,
    };
  }

  static async runExpirationJob() {
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const day = 24 * 60 * 60 * 1000;
    const t31 = new Date(t0.getTime() + 31 * day);
    const t91 = new Date(t0.getTime() + 91 * day);

    // Atualiza status em lote por faixas de validade (equivalente a calculateExpirationStatus).
    const [expired, critical, warning, valid] = await prisma.$transaction([
      prisma.productBatch.updateMany({
        where: { expirationDate: { lt: t0 }, status: { not: 'EXPIRED' } },
        data: { status: 'EXPIRED' },
      }),
      prisma.productBatch.updateMany({
        where: { expirationDate: { gte: t0, lt: t31 }, status: { not: 'CRITICAL' } },
        data: { status: 'CRITICAL' },
      }),
      prisma.productBatch.updateMany({
        where: { expirationDate: { gte: t31, lt: t91 }, status: { not: 'WARNING' } },
        data: { status: 'WARNING' },
      }),
      prisma.productBatch.updateMany({
        where: { expirationDate: { gte: t91 }, status: { not: 'VALID' } },
        data: { status: 'VALID' },
      }),
    ]);

    const statusUpdated = expired.count + critical.count + warning.count + valid.count;

    // Alertas: apenas lotes com estoque dentro da janela de 90 dias (ou vencidos).
    const alertBatches = await prisma.productBatch.findMany({
      where: { quantity: { gt: 0 }, expirationDate: { lt: t91 } },
      select: { id: true, expirationDate: true },
    });

    const desired = alertBatches.flatMap((batch) =>
      getApplicableAlertTypes(batch.expirationDate).map((alertType) => ({
        batchId: batch.id,
        alertType,
      }))
    );

    const existing = await prisma.expirationAlert.findMany({
      where: { batchId: { in: alertBatches.map((b) => b.id) } },
      select: { batchId: true, alertType: true },
    });
    const existingKeys = new Set(existing.map((a) => `${a.batchId}:${a.alertType}`));

    const toCreate = desired.filter((d) => !existingKeys.has(`${d.batchId}:${d.alertType}`));

    if (toCreate.length > 0) {
      await prisma.expirationAlert.createMany({ data: toCreate, skipDuplicates: true });
    }

    return { processed: alertBatches.length, statusUpdated, alertsCreated: toCreate.length };
  }

  /** FEFO: retorna lotes ordenados por validade (mais próximo primeiro) */
  static async getFefoBatches(productId: string, locationId: string, requiredQty: number) {
    const items = await prisma.stockItem.findMany({
      where: {
        productId,
        locationId,
        quantity: { gt: 0 },
        batchId: { not: null },
      },
      include: { batch: true },
      orderBy: { batch: { expirationDate: 'asc' } },
    });

    const plan: { batchId: string; quantity: number; batch: NonNullable<(typeof items)[0]['batch']> }[] = [];
    let remaining = requiredQty;

    for (const item of items) {
      if (!item.batch || remaining <= 0) break;
      if (calculateExpirationStatus(item.batch.expirationDate) === 'EXPIRED') continue;
      const take = Math.min(item.quantity, remaining);
      if (take > 0) {
        plan.push({ batchId: item.batchId!, quantity: take, batch: item.batch });
        remaining -= take;
      }
    }

    if (remaining > 0) {
      throw new ValidationError(
        `Quantidade insuficiente em lotes válidos. Faltam ${remaining} unidades (FEFO).`
      );
    }

    return plan;
  }

  static async findOrCreateForEntry(
    tx: Prisma.TransactionClient,
    params: {
      productId: string;
      stockLocationId: string;
      batchNumber: string;
      expirationDate: Date;
      manufacturingDate?: Date | null;
      quantity: number;
      supplierId?: string;
      unitCost?: number;
      userId: string;
    }
  ) {
    try {
      validateExpirationDate(params.expirationDate, params.manufacturingDate ?? undefined);
    } catch (e) {
      throw new ValidationError((e as Error).message);
    }
    const status = calculateExpirationStatus(params.expirationDate);

    const batch = await tx.productBatch.upsert({
      where: {
        productId_stockLocationId_batchNumber: {
          productId: params.productId,
          stockLocationId: params.stockLocationId,
          batchNumber: params.batchNumber,
        },
      },
      create: {
        productId: params.productId,
        stockLocationId: params.stockLocationId,
        batchNumber: params.batchNumber,
        expirationDate: params.expirationDate,
        manufacturingDate: params.manufacturingDate,
        quantity: 0,
        supplierId: params.supplierId,
        unitCost: params.unitCost ? new Prisma.Decimal(params.unitCost) : undefined,
        status,
        createdById: params.userId,
      },
      update: {
        expirationDate: params.expirationDate,
        manufacturingDate: params.manufacturingDate,
        status,
        supplierId: params.supplierId,
        unitCost: params.unitCost !== undefined ? new Prisma.Decimal(params.unitCost) : undefined,
      },
    });

    return batch;
  }

  /**
   * Lote equivalente no local (mesmo número). Transferências antigas reutilizavam
   * o UUID do lote de origem, então o saldo físico pode apontar para outro id.
   */
  static async findEquivalentAtLocation(
    db: Prisma.TransactionClient | typeof prisma,
    productId: string,
    locationId: string,
    batchId: string | null | undefined
  ): Promise<string | null> {
    if (!batchId) return null;

    const atLocation = await db.stockItem.findFirst({
      where: { productId, locationId, batchId },
      select: { id: true },
    });
    if (atLocation) return batchId;

    const preferred = await db.productBatch.findUnique({
      where: { id: batchId },
      select: { batchNumber: true, productId: true },
    });
    if (!preferred || preferred.productId !== productId) return batchId;

    const equivalent = await db.productBatch.findUnique({
      where: {
        productId_stockLocationId_batchNumber: {
          productId,
          stockLocationId: locationId,
          batchNumber: preferred.batchNumber,
        },
      },
      select: { id: true },
    });
    return equivalent?.id ?? batchId;
  }

  /** Garante um lote cadastrado no local de destino, copiando número e validade. */
  static async ensureAtLocation(
    tx: Prisma.TransactionClient,
    originBatchId: string,
    locationId: string,
    userId?: string
  ): Promise<string> {
    const origin = await tx.productBatch.findUnique({ where: { id: originBatchId } });
    if (!origin) throw new ValidationError('Lote não encontrado');
    if (origin.stockLocationId === locationId) return origin.id;

    const existing = await tx.productBatch.findUnique({
      where: {
        productId_stockLocationId_batchNumber: {
          productId: origin.productId,
          stockLocationId: locationId,
          batchNumber: origin.batchNumber,
        },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    try {
      const created = await tx.productBatch.create({
        data: {
          productId: origin.productId,
          stockLocationId: locationId,
          batchNumber: origin.batchNumber,
          expirationDate: origin.expirationDate,
          manufacturingDate: origin.manufacturingDate,
          quantity: 0,
          supplierId: origin.supplierId,
          unitCost: origin.unitCost ?? undefined,
          status: calculateExpirationStatus(origin.expirationDate),
          createdById: userId ?? origin.createdById,
        },
        select: { id: true },
      });
      return created.id;
    } catch (e) {
      if (getPrismaErrorCode(e) !== 'P2002') throw e;
      const retry = await tx.productBatch.findUnique({
        where: {
          productId_stockLocationId_batchNumber: {
            productId: origin.productId,
            stockLocationId: locationId,
            batchNumber: origin.batchNumber,
          },
        },
        select: { id: true },
      });
      if (!retry) throw e;
      return retry.id;
    }
  }
}
