import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createProductSchema, updateProductSchema, createBatchSchema } from './products.dto';
import { BatchService } from '../batches/BatchService';

type CreateProductDTO = z.infer<typeof createProductSchema>;
type UpdateProductDTO = z.infer<typeof updateProductSchema>;
type CreateBatchDTO = z.infer<typeof createBatchSchema>;

export class ProductService {
  static async list(filters: Record<string, string | undefined>) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where: Prisma.ProductWhereInput = {};
    if (filters.includeInactive !== 'true') {
      where.active = true;
    } else if (filters.active === 'true' || filters.active === 'false') {
      where.active = filters.active === 'true';
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { internalCode: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.categoryId) where.categoryId = filters.categoryId;

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        include: {
          category: true,
          stockItems: { include: { location: true, batch: true } },
          batches: { orderBy: { expirationDate: 'asc' } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    let enriched = data.map((p) => ({
      ...p,
      totalStock: p.stockItems.reduce((s, i) => s + i.quantity, 0),
    }));

    if (filters.belowMin === 'true') {
      enriched = enriched.filter((p) => p.totalStock < p.minQuantity);
    }

    if (filters.expiringDays) {
      const days = parseInt(filters.expiringDays, 10);
      const limit = new Date();
      limit.setDate(limit.getDate() + days);
      enriched = enriched.filter((p) =>
        p.batches.some((b) => b.expirationDate <= limit && b.expirationDate >= new Date())
      );
    }

    return buildPaginatedResult(enriched, filters.belowMin || filters.expiringDays ? enriched.length : total, pagination);
  }

  static async findById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        batches: { orderBy: { expirationDate: 'asc' } },
        stockItems: { include: { location: true, batch: true } },
      },
    });
    if (!product) throw new NotFoundError('Produto não encontrado');
    return {
      ...product,
      totalStock: product.stockItems.reduce((s, i) => s + i.quantity, 0),
    };
  }

  static async create(data: CreateProductDTO) {
    const exists = await prisma.product.findUnique({
      where: { internalCode: data.internalCode },
    });
    if (exists) throw new ValidationError('Código interno já existe');

    return prisma.product.create({
      data,
      include: { category: true },
    });
  }

  static async update(id: string, data: UpdateProductDTO) {
    await this.findById(id);
    return prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  static async delete(id: string) {
    await prisma.product.update({ where: { id }, data: { active: false } });
    return { message: 'Produto desativado' };
  }

  static async createBatch(data: CreateBatchDTO, userId: string) {
    if (!data.locationId) throw new ValidationError('Local de estoque obrigatório');
    return BatchService.create(
      {
        productId: data.productId,
        stockLocationId: data.locationId,
        batchNumber: data.lot,
        expirationDate: data.expiryDate,
        manufacturingDate: new Date().toISOString(),
        quantity: data.quantity || 0,
      },
      userId
    );
  }

  static async globalSearch(query: string) {
    const q = query.trim();
    if (!q) return { products: [], movements: [], locations: [] };

    const [products, movements, locations] = await Promise.all([
      prisma.product.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { internalCode: { contains: q, mode: 'insensitive' } },
            { barcode: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: { id: true, name: true, internalCode: true, barcode: true },
      }),
      prisma.stockMovement.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: q, mode: 'insensitive' } },
            { reason: { contains: q, mode: 'insensitive' } },
            { product: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: 10,
        include: { product: { select: { name: true } } },
      }),
      prisma.stockLocation.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
    ]);

    return { products, movements, locations };
  }
}
