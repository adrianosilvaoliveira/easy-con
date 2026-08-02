import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createLocationSchema, updateLocationSchema } from './stock.dto';

type CreateLocationDTO = z.infer<typeof createLocationSchema>;
type UpdateLocationDTO = z.infer<typeof updateLocationSchema>;

interface LocationAggRow {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalQuantity: number;
  productCount: number;
}

interface BelowMinRow {
  id: string;
  name: string;
  internalCode: string;
  minQuantity: number;
  current: number;
}

export class StockService {
  static async listLocations(filters: Record<string, string | undefined> = {}) {
    const includeInactive = filters.includeInactive === 'true';
    const search = filters.search?.trim();

    const activeClause = includeInactive ? Prisma.sql`TRUE` : Prisma.sql`l.active = true`;
    const searchClause = search
      ? Prisma.sql`AND (l.name ILIKE ${`%${search}%`} OR l.code ILIKE ${`%${search}%`})`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<LocationAggRow[]>(Prisma.sql`
      SELECT
        l.id, l.name, l.code, l.type, l.description, l.active,
        l."createdAt", l."updatedAt",
        COALESCE(SUM(si.quantity) FILTER (WHERE si.quantity > 0), 0)::int AS "totalQuantity",
        COUNT(DISTINCT si."productId") FILTER (WHERE si.quantity > 0)::int AS "productCount"
      FROM stock_locations l
      LEFT JOIN stock_items si ON si."locationId" = l.id
      WHERE ${activeClause}
      ${searchClause}
      GROUP BY l.id
      ORDER BY l.name ASC
    `);

    return rows;
  }

  static async findLocation(id: string) {
    const location = await prisma.stockLocation.findUnique({
      where: { id },
      include: {
        stockItems: {
          include: {
            product: { include: { category: true } },
            batch: true,
          },
        },
      },
    });
    if (!location) throw new NotFoundError('Local de estoque não encontrado');
    return location;
  }

  /** Existência leve — evita carregar o grafo de estoque em mutações. */
  private static async assertLocationExists(id: string) {
    const location = await prisma.stockLocation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!location) throw new NotFoundError('Local de estoque não encontrado');
  }

  static async createLocation(data: CreateLocationDTO) {
    const exists = await prisma.stockLocation.findUnique({ where: { code: data.code } });
    if (exists) throw new ValidationError('Código do local já existe');
    return prisma.stockLocation.create({ data });
  }

  static async updateLocation(id: string, data: UpdateLocationDTO) {
    await this.assertLocationExists(id);
    if (data.code) {
      const exists = await prisma.stockLocation.findFirst({
        where: { code: data.code, NOT: { id } },
      });
      if (exists) throw new ValidationError('Código do local já existe');
    }
    return prisma.stockLocation.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
  }

  static async deactivateLocation(id: string) {
    await this.assertLocationExists(id);
    await prisma.stockLocation.update({ where: { id }, data: { active: false } });
    return { message: 'Local desativado' };
  }

  /** Verifica se o local pode ser excluído sem afetar produtos nem relatórios históricos */
  static async getLocationDeleteCheck(id: string) {
    await this.assertLocationExists(id);

    const [
      stockItemsCount,
      stockWithBalance,
      batchesCount,
      batchesWithBalance,
      movementsCount,
      inventoriesCount,
    ] = await Promise.all([
      prisma.stockItem.count({ where: { locationId: id } }),
      prisma.stockItem.count({ where: { locationId: id, quantity: { gt: 0 } } }),
      prisma.productBatch.count({ where: { stockLocationId: id } }),
      prisma.productBatch.count({ where: { stockLocationId: id, quantity: { gt: 0 } } }),
      prisma.stockMovement.count({
        where: {
          OR: [{ originLocationId: id }, { destinationLocationId: id }],
        },
      }),
      prisma.inventory.count({ where: { locationId: id } }),
    ]);

    const reasons: string[] = [];
    if (stockWithBalance > 0) {
      reasons.push(
        `Há ${stockWithBalance} produto(s) com saldo neste local. Transfira ou zere o estoque antes de excluir.`
      );
    } else if (stockItemsCount > 0) {
      reasons.push('Existem registros de produtos vinculados a este local.');
    }
    if (batchesWithBalance > 0) {
      reasons.push(`Há ${batchesWithBalance} lote(s) com quantidade neste local.`);
    } else if (batchesCount > 0) {
      reasons.push('Existem lotes cadastrados neste local.');
    }
    if (movementsCount > 0) {
      reasons.push(
        `Há ${movementsCount} movimentação(ões) no histórico. A exclusão prejudicaria relatórios.`
      );
    }
    if (inventoriesCount > 0) {
      reasons.push(`Há ${inventoriesCount} inventário(s) vinculado(s) a este local.`);
    }

    const canDelete = reasons.length === 0;

    return {
      canDelete,
      reasons,
      counts: {
        stockItems: stockItemsCount,
        stockWithBalance,
        batches: batchesCount,
        batchesWithBalance,
        movements: movementsCount,
        inventories: inventoriesCount,
      },
    };
  }

  static async deleteLocation(id: string) {
    const check = await this.getLocationDeleteCheck(id);
    if (!check.canDelete) {
      throw new ValidationError(
        check.reasons.length === 1
          ? check.reasons[0]
          : `Não é possível excluir este local: ${check.reasons.join(' ')}`
      );
    }

    await prisma.stockLocation.delete({ where: { id } });
    return { message: 'Local excluído permanentemente' };
  }

  static async listStockItems(filters: Record<string, string | undefined>) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where: Prisma.StockItemWhereInput = { quantity: { gt: 0 } };

    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.batch?.trim()) {
      where.batch = { batchNumber: { contains: filters.batch.trim(), mode: 'insensitive' } };
    }

    const productWhere: Prisma.ProductWhereInput = {};
    if (filters.includeInactive !== 'true') {
      productWhere.active = true;
    }
    if (filters.search) {
      productWhere.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { internalCode: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(productWhere).length > 0) {
      where.product = productWhere;
    }

    const [data, total] = await Promise.all([
      prisma.stockItem.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              internalCode: true,
              barcode: true,
              productType: true,
              active: true,
              minQuantity: true,
              unit: true,
              category: { select: { id: true, name: true } },
            },
          },
          location: { select: { id: true, name: true, code: true, type: true } },
          batch: {
            select: {
              id: true,
              batchNumber: true,
              expirationDate: true,
              status: true,
              quantity: true,
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
      }),
      prisma.stockItem.count({ where }),
    ]);

    return buildPaginatedResult(data, total, pagination);
  }

  static async getAlerts() {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [belowMin, expiring] = await Promise.all([
      prisma.$queryRaw<BelowMinRow[]>(Prisma.sql`
        SELECT p.id, p.name, p."internalCode" AS "internalCode",
          p."minQuantity" AS "minQuantity",
          COALESCE(SUM(si.quantity), 0)::int AS current
        FROM products p
        LEFT JOIN stock_items si ON si."productId" = p.id
        WHERE p.active = true
        GROUP BY p.id
        HAVING COALESCE(SUM(si.quantity), 0) < p."minQuantity"
        ORDER BY p.name
      `),
      prisma.productBatch.findMany({
        where: {
          expirationDate: { lte: in30Days, gte: new Date() },
          quantity: { gt: 0 },
        },
        select: {
          id: true,
          batchNumber: true,
          expirationDate: true,
          quantity: true,
          status: true,
          product: { select: { id: true, name: true, internalCode: true } },
        },
        orderBy: { expirationDate: 'asc' },
        take: 100,
      }),
    ]);

    return { belowMin, expiring };
  }
}
