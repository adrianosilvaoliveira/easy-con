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
} from '../../shared/utils/expiration';
import { AuditService } from '../../services/AuditService';
import { AlertService } from './AlertService';
import { z } from 'zod';
import { createBatchSchema, updateBatchSchema } from './batches.dto';

type CreateBatchDTO = z.infer<typeof createBatchSchema>;
type UpdateBatchDTO = z.infer<typeof updateBatchSchema>;

export class BatchService {
  static buildWhere(filters: Record<string, string | undefined>): Prisma.ProductBatchWhereInput {
    const where: Prisma.ProductBatchWhereInput = {};

    if (filters.productId) where.productId = filters.productId;
    if (filters.stockLocationId) where.stockLocationId = filters.stockLocationId;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.batchNumber) where.batchNumber = { contains: filters.batchNumber, mode: 'insensitive' };
    if (filters.status) where.status = filters.status as ExpirationStatus;
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
      const limit = new Date();
      limit.setDate(limit.getDate() + Number(filters.expiringDays));
      where.expirationDate = { lte: limit, gte: new Date() };
      where.status = { not: 'EXPIRED' };
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
      data.map((b) => ({ ...b, daysUntilExpiration: daysUntilExpiration(b.expirationDate) })),
      total,
      pagination
    );
  }

  static async listExpiring(days = 90, filters: Record<string, string | undefined> = {}) {
    return this.list({ ...filters, expiringDays: String(days), page: filters.page, limit: filters.limit });
  }

  static async listExpired(filters: Record<string, string | undefined> = {}) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where: Prisma.ProductBatchWhereInput = {
      status: 'EXPIRED',
      ...this.buildWhere(filters),
    };
    delete (where as { quantity?: unknown }).quantity;

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

    return buildPaginatedResult(data, total, pagination);
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
    return { ...batch, daysUntilExpiration: daysUntilExpiration(batch.expirationDate) };
  }

  static async create(data: CreateBatchDTO, userId: string) {
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
    const manufacturingDate = data.manufacturingDate
      ? new Date(data.manufacturingDate)
      : existing.manufacturingDate;

    if (data.expirationDate || data.manufacturingDate) {
      try {
        validateExpirationDate(expirationDate, manufacturingDate);
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
    if (!batch || batch.quantity <= 0) return;

    const status = calculateExpirationStatus(batch.expirationDate);
    await prisma.productBatch.update({ where: { id: batchId }, data: { status } });

    const types = getApplicableAlertTypes(batch.expirationDate);
    for (const alertType of types) {
      await prisma.expirationAlert.upsert({
        where: { batchId_alertType: { batchId, alertType } },
        update: { alertDate: new Date() },
        create: { batchId, alertType },
      });
      await AuditService.log({
        action: 'GENERATE_ALERT',
        module: 'expiration',
        entityId: batchId,
        details: { alertType, batchNumber: batch.batchNumber },
      });
    }
  }

  static async getDashboardMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [expired, critical, warning, valid, alertsCount, batches] = await Promise.all([
      prisma.productBatch.count({ where: { status: 'EXPIRED', quantity: { gt: 0 } } }),
      prisma.productBatch.count({ where: { status: 'CRITICAL', quantity: { gt: 0 } } }),
      prisma.productBatch.count({ where: { status: 'WARNING', quantity: { gt: 0 } } }),
      prisma.productBatch.count({ where: { status: 'VALID', quantity: { gt: 0 } } }),
      AlertService.countActive(),
      prisma.productBatch.findMany({
        where: { quantity: { gt: 0 } },
        select: {
          expirationDate: true,
          quantity: true,
          unitCost: true,
          status: true,
        },
      }),
    ]);

    const financialLoss = batches
      .filter((b) => b.status === 'EXPIRED')
      .reduce((sum, b) => sum + b.quantity * Number(b.unitCost || 0), 0);

    const monthMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }

    batches.forEach((b) => {
      if (b.status === 'EXPIRED') return;
      const key = `${b.expirationDate.getFullYear()}-${String(b.expirationDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + b.quantity);
    });

    const expiringByMonth = Array.from(monthMap.entries()).map(([month, count]) => ({
      month,
      count,
    }));

    const criticalBatches = await prisma.productBatch.findMany({
      where: { status: { in: ['CRITICAL', 'EXPIRED'] }, quantity: { gt: 0 } },
      take: 10,
      orderBy: { expirationDate: 'asc' },
      include: {
        product: { select: { name: true, internalCode: true } },
        stockLocation: { select: { name: true } },
      },
    });

    return {
      counts: { expired, critical, warning, valid, alertsCount },
      financialLoss,
      expiringByMonth,
      criticalBatches,
    };
  }

  static async runExpirationJob() {
    const batches = await prisma.productBatch.findMany({
      where: { quantity: { gt: 0 } },
    });

    let updated = 0;
    for (const batch of batches) {
      const status = calculateExpirationStatus(batch.expirationDate);
      if (status !== batch.status) {
        await prisma.productBatch.update({ where: { id: batch.id }, data: { status } });
        updated++;
      }
      await this.syncBatchAlerts(batch.id);
    }

    return { processed: batches.length, statusUpdated: updated };
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
      if (item.batch.status === 'EXPIRED') continue;
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
}
