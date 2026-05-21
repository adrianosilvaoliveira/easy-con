import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { z } from 'zod';

const createInventorySchema = z.object({
  locationId: z.string().uuid(),
  notes: z.string().optional(),
});

const addItemSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  countedQuantity: z.number().int().min(0),
});

export class InventoryService {
  static async list(filters: Record<string, string | undefined>) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where = filters.status
      ? { status: filters.status as 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO' }
      : {};

    const [data, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { startedAt: 'desc' },
        include: {
          location: true,
          user: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    return buildPaginatedResult(data, total, pagination);
  }

  static async create(data: z.infer<typeof createInventorySchema>, userId: string) {
    const active = await prisma.inventory.findFirst({
      where: { locationId: data.locationId, status: 'EM_ANDAMENTO' },
    });
    if (active) throw new ValidationError('Já existe inventário em andamento neste local');

    const stockItems = await prisma.stockItem.findMany({
      where: { locationId: data.locationId, quantity: { gt: 0 } },
    });

    return prisma.inventory.create({
      data: {
        locationId: data.locationId,
        userId,
        notes: data.notes,
        items: {
          create: stockItems.map((item) => ({
            productId: item.productId,
            batchId: item.batchId,
            systemQuantity: item.quantity,
            countedQuantity: item.quantity,
            divergence: 0,
          })),
        },
      },
      include: {
        location: true,
        items: { include: { product: true } },
      },
    });
  }

  static async addOrUpdateItem(
    inventoryId: string,
    data: z.infer<typeof addItemSchema>
  ) {
    const inventory = await prisma.inventory.findUnique({ where: { id: inventoryId } });
    if (!inventory || inventory.status !== 'EM_ANDAMENTO') {
      throw new ValidationError('Inventário não está em andamento');
    }

    const stockItem = await prisma.stockItem.findFirst({
      where: {
        productId: data.productId,
        locationId: inventory.locationId,
        batchId: data.batchId ?? null,
      },
    });

    const systemQty = stockItem?.quantity ?? 0;
    const divergence = data.countedQuantity - systemQty;

    const existing = await prisma.inventoryItem.findFirst({
      where: { inventoryId, productId: data.productId },
    });

    if (existing) {
      return prisma.inventoryItem.update({
        where: { id: existing.id },
        data: {
          countedQuantity: data.countedQuantity,
          divergence,
        },
        include: { product: true },
      });
    }

    return prisma.inventoryItem.create({
      data: {
        inventoryId,
        productId: data.productId,
        batchId: data.batchId,
        systemQuantity: systemQty,
        countedQuantity: data.countedQuantity,
        divergence,
      },
      include: { product: true },
    });
  }

  static async complete(inventoryId: string, userId: string, autoAdjust = true) {
    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      include: { items: true, location: true },
    });

    if (!inventory) throw new NotFoundError('Inventário não encontrado');
    if (inventory.status !== 'EM_ANDAMENTO') {
      throw new ValidationError('Inventário já finalizado');
    }

    if (autoAdjust) {
      for (const item of inventory.items) {
        if (item.divergence === 0) continue;

        const stockItem = await prisma.stockItem.findFirst({
          where: {
            productId: item.productId,
            locationId: inventory.locationId,
            batchId: item.batchId ?? null,
          },
        });

        if (stockItem) {
          await prisma.stockItem.update({
            where: { id: stockItem.id },
            data: { quantity: item.countedQuantity },
          });
        }

        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { adjusted: true },
        });

        await prisma.stockMovement.create({
          data: {
            type: item.divergence > 0 ? 'AJUSTE_ENTRADA' : 'SAIDA_PERDA',
            status: 'CONCLUIDA',
            productId: item.productId,
            batchId: item.batchId,
            quantity: Math.abs(item.divergence),
            destinationLocationId: item.divergence > 0 ? inventory.locationId : undefined,
            originLocationId: item.divergence < 0 ? inventory.locationId : undefined,
            reason: `Ajuste automático de inventário #${inventoryId.slice(0, 8)}`,
            userId,
            movementDate: new Date(),
          },
        });
      }
    }

    return prisma.inventory.update({
      where: { id: inventoryId },
      data: { status: 'CONCLUIDO', completedAt: new Date() },
      include: {
        items: { include: { product: true } },
        location: true,
        user: { select: { name: true } },
      },
    });
  }

  static async findById(id: string) {
    const inventory = await prisma.inventory.findUnique({
      where: { id },
      include: {
        location: true,
        user: { select: { id: true, name: true } },
        items: { include: { product: true }, orderBy: { product: { name: 'asc' } } },
      },
    });
    if (!inventory) throw new NotFoundError('Inventário não encontrado');
    return inventory;
  }
}
