import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createProductSchema, updateProductSchema, createBatchSchema, kitItemSchema } from './products.dto';
import { normalizeProductName } from '../../shared/utils/productName';
import { generateInternalCode, normalizeInternalCode } from '../../shared/utils/internalCode';
import { generateEan13Barcode } from '../../shared/utils/ean13';
import { BatchService } from '../batches/BatchService';

type CreateProductDTO = z.infer<typeof createProductSchema>;
type UpdateProductDTO = z.infer<typeof updateProductSchema>;
type CreateBatchDTO = z.infer<typeof createBatchSchema>;
type KitItemDTO = z.infer<typeof kitItemSchema>;

const kitInclude = {
  category: true,
  kitItems: {
    include: {
      componentProduct: {
        select: {
          id: true,
          name: true,
          internalCode: true,
          barcode: true,
          productType: true,
        },
      },
      batch: {
        select: {
          id: true,
          batchNumber: true,
          expirationDate: true,
          productId: true,
          stockLocation: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  stockItems: { include: { location: true, batch: true } },
  batches: { orderBy: { expirationDate: 'asc' as const } },
};

async function validateKitItems(items: KitItemDTO[] | undefined) {
  if (!items || items.length < 2) {
    throw new ValidationError('O kit deve conter pelo menos dois produtos');
  }

  const seen = new Set<string>();
  const componentIds = items.map((i) => i.componentProductId);
  const batchIds = items.map((i) => i.batchId).filter((id): id is string => Boolean(id));

  const [components, batches, productsWithLots] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: componentIds } },
      select: { id: true, name: true, productType: true, active: true },
    }),
    batchIds.length
      ? prisma.productBatch.findMany({
          where: { id: { in: batchIds } },
          select: { id: true, productId: true },
        })
      : Promise.resolve([] as { id: string; productId: string }[]),
    prisma.productBatch.findMany({
      where: { productId: { in: componentIds } },
      distinct: ['productId'],
      select: { productId: true },
    }),
  ]);

  const componentMap = new Map(components.map((c) => [c.id, c]));
  const batchMap = new Map(batches.map((b) => [b.id, b]));
  const lotProductIds = new Set(productsWithLots.map((b) => b.productId));

  for (const item of items) {
    const key = `${item.componentProductId}:${item.batchId ?? 'none'}`;
    if (seen.has(key)) {
      throw new ValidationError('Há produtos/lotes duplicados no kit');
    }
    seen.add(key);

    const component = componentMap.get(item.componentProductId);
    if (!component || !component.active) {
      throw new ValidationError('Produto componente inválido ou inativo');
    }
    if (component.productType === 'KIT') {
      throw new ValidationError(`"${component.name}" é um kit e não pode compor outro kit`);
    }

    if (lotProductIds.has(item.componentProductId) && !item.batchId) {
      throw new ValidationError(
        `Informe o lote de "${component.name}" — ele fica gravado na composição do kit`
      );
    }

    if (item.batchId) {
      const batch = batchMap.get(item.batchId);
      if (!batch || batch.productId !== item.componentProductId) {
        throw new ValidationError(`Lote inválido para o produto "${component.name}"`);
      }
    }

    if (item.quantity < 1) {
      throw new ValidationError('Quantidade de cada item do kit deve ser pelo menos 1');
    }
  }
}

async function replaceKitItems(kitProductId: string, items: KitItemDTO[]) {
  await prisma.productKitItem.deleteMany({ where: { kitProductId } });
  await prisma.productKitItem.createMany({
    data: items.map((item) => ({
      kitProductId,
      componentProductId: item.componentProductId,
      quantity: item.quantity,
      batchId: item.batchId || null,
    })),
  });
}

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

    if (filters.productType === 'PRODUCT' || filters.productType === 'KIT') {
      where.productType = filters.productType;
    } else if (filters.excludeKits === 'true') {
      where.productType = 'PRODUCT';
    }

    if (filters.expiringDays) {
      const days = parseInt(filters.expiringDays, 10);
      const now = new Date();
      const limit = new Date();
      limit.setDate(limit.getDate() + days);
      where.batches = {
        some: {
          expirationDate: { lte: limit, gte: now },
          quantity: { gt: 0 },
        },
      };
    }

    if (filters.belowMin === 'true') {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM products p
        LEFT JOIN stock_items si ON si."productId" = p.id
        WHERE (${filters.includeInactive === 'true'} OR p.active = true)
        GROUP BY p.id, p."minQuantity"
        HAVING COALESCE(SUM(si.quantity), 0) < p."minQuantity"
      `;
      if (rows.length === 0) {
        return buildPaginatedResult([], 0, pagination);
      }
      where.id = { in: rows.map((r) => r.id) };
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          internalCode: true,
          barcode: true,
          productType: true,
          categoryId: true,
          manufacturer: true,
          unit: true,
          minQuantity: true,
          notes: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          _count: { select: { kitItems: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const stockSums =
      data.length === 0
        ? []
        : await prisma.stockItem.groupBy({
            by: ['productId'],
            where: { productId: { in: data.map((p) => p.id) } },
            _sum: { quantity: true },
          });
    const stockMap = new Map(stockSums.map((s) => [s.productId, s._sum.quantity ?? 0]));

    const enriched = data.map((p) => {
      const { _count, ...rest } = p;
      return {
        ...rest,
        totalStock: stockMap.get(p.id) ?? 0,
        kitItems: Array.from({ length: _count.kitItems }, () => ({})),
      };
    });

    return buildPaginatedResult(enriched, total, pagination);
  }

  static async findById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: kitInclude,
    });
    if (!product) throw new NotFoundError('Produto não encontrado');
    return {
      ...product,
      totalStock: product.stockItems.reduce((s, i) => s + i.quantity, 0),
    };
  }

  static async create(data: CreateProductDTO) {
    const productType = data.productType ?? 'PRODUCT';
    const { kitItems, location: _location, productType: _pt, ...rest } = data;

    if (productType === 'KIT') {
      await validateKitItems(kitItems);
    } else if (kitItems?.length) {
      throw new ValidationError('Itens de kit só são permitidos para produtos do tipo KIT');
    }

    const internalCode = rest.internalCode ?? (await generateInternalCode());
    const exists = await prisma.product.findUnique({ where: { internalCode } });
    if (exists) throw new ValidationError('Código interno já existe');

    const barcode =
      productType === 'KIT' ? await generateEan13Barcode() : rest.barcode || undefined;

    const product = await prisma.product.create({
      data: {
        ...rest,
        internalCode,
        barcode,
        productType,
        name: normalizeProductName(rest.name),
        unit: productType === 'KIT' ? rest.unit || 'KIT' : rest.unit,
      },
      include: { category: true },
    });

    if (productType === 'KIT' && kitItems) {
      await replaceKitItems(product.id, kitItems);
      return this.findById(product.id);
    }

    return product;
  }

  static async update(id: string, data: UpdateProductDTO) {
    const existing = await this.findById(id);
    const { location: _location, kitItems, productType: _ignoredType, ...dataWithoutLocation } =
      data;

    if (existing.productType === 'KIT' && kitItems !== undefined) {
      await validateKitItems(kitItems);
    } else if (existing.productType !== 'KIT' && kitItems?.length) {
      throw new ValidationError('Itens de kit só são permitidos para produtos do tipo KIT');
    }

    const normalized =
      dataWithoutLocation.name !== undefined
        ? { ...dataWithoutLocation, name: normalizeProductName(dataWithoutLocation.name) }
        : dataWithoutLocation;

    let updateData: Prisma.ProductUpdateInput = { ...normalized };

    if (dataWithoutLocation.internalCode !== undefined) {
      const internalCode = normalizeInternalCode(dataWithoutLocation.internalCode);
      if (!internalCode) throw new ValidationError('Código interno obrigatório');
      const duplicate = await prisma.product.findFirst({
        where: { internalCode, NOT: { id } },
      });
      if (duplicate) throw new ValidationError('Código interno já existe');
      updateData = { ...updateData, internalCode };
    }

    // Kits mantêm o código de barras gerado; não sobrescrever com vazio
    if (existing.productType === 'KIT') {
      delete (updateData as { barcode?: string }).barcode;
    }

    await prisma.product.update({
      where: { id },
      data: updateData,
    });

    if (existing.productType === 'KIT' && kitItems !== undefined) {
      await replaceKitItems(id, kitItems);
    }

    return this.findById(id);
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
        select: {
          id: true,
          name: true,
          internalCode: true,
          barcode: true,
          productType: true,
        },
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

  /** Lotes de um produto (para montagem de kit). */
  static async listProductBatches(productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Produto não encontrado');

    const batches = await prisma.productBatch.findMany({
      where: { productId },
      orderBy: { expirationDate: 'asc' },
      include: {
        stockLocation: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      hasLots: batches.length > 0,
      batches: batches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        expirationDate: b.expirationDate,
        quantity: b.quantity,
        status: b.status,
        location: b.stockLocation,
      })),
    };
  }
}
