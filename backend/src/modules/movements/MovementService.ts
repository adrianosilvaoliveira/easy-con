import { MovementStatus, MovementType, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { z } from 'zod';
import { entrySchema, exitSchema, transferSchema } from './movements.dto';
import { BatchService } from '../batches/BatchService';

type EntryDTO = z.infer<typeof entrySchema>;
type ExitDTO = z.infer<typeof exitSchema>;
type TransferDTO = z.infer<typeof transferSchema>;

const ENTRY_TYPES: MovementType[] = [
  'ENTRADA_COMPRA',
  'ENTRADA_MANUAL',
  'AJUSTE_ENTRADA',
  'DEVOLUCAO',
];

const EXIT_TYPES: MovementType[] = [
  'SAIDA_CONSUMO',
  'SAIDA_CIRURGIA',
  'SAIDA_CONSULTA',
  'SAIDA_PERDA',
  'SAIDA_VENCIMENTO',
];

export class MovementService {
  private static async updateStock(
    productId: string,
    locationId: string,
    batchId: string | null | undefined,
    quantityDelta: number
  ) {
    const batchKey = batchId ?? null;
    const existing = await prisma.stockItem.findFirst({
      where: { productId, locationId, batchId: batchKey },
    });

    if (existing) {
      const newQty = existing.quantity + quantityDelta;
      if (newQty < 0) throw new ValidationError('Quantidade insuficiente em estoque');
      await prisma.stockItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    } else if (quantityDelta > 0) {
      await prisma.stockItem.create({
        data: {
          productId,
          locationId,
          batchId: batchKey,
          quantity: quantityDelta,
        },
      });
    } else {
      throw new ValidationError('Item não encontrado no estoque de origem');
    }
  }

  static async createEntry(data: EntryDTO, userId: string) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new NotFoundError('Produto não encontrado');

    const movementDate = data.movementDate ? new Date(data.movementDate) : new Date();

    try {
      const movements = await prisma.$transaction(async (tx) => {
        const created = [];

        for (const line of data.batches) {
          const expirationDate = new Date(line.expirationDate);
          const manufacturingDate = new Date(line.manufacturingDate);
          const totalValue = line.unitPrice
            ? new Prisma.Decimal(line.unitPrice * line.quantity)
            : undefined;

          const batch = await BatchService.findOrCreateForEntry(tx, {
            productId: data.productId,
            stockLocationId: data.destinationLocationId,
            batchNumber: line.batchNumber.trim(),
            expirationDate,
            manufacturingDate,
            quantity: line.quantity,
            supplierId: data.supplierId,
            unitCost: line.unitPrice,
            userId,
          });

          const mov = await tx.stockMovement.create({
            data: {
              type: data.type,
              status: 'CONCLUIDA',
              productId: data.productId,
              batchId: batch.id,
              quantity: line.quantity,
              unitPrice: line.unitPrice ? new Prisma.Decimal(line.unitPrice) : undefined,
              totalValue,
              destinationLocationId: data.destinationLocationId,
              supplierId: data.supplierId,
              invoiceNumber: data.invoiceNumber,
              reason: data.reason,
              notes: data.notes,
              movementDate,
              userId,
            },
            include: {
              product: true,
              destinationLocation: true,
              supplier: true,
              batch: true,
              user: { select: { id: true, name: true } },
            },
          });

          await this.updateStockInTx(
            tx,
            data.productId,
            data.destinationLocationId,
            batch.id,
            line.quantity
          );
          await BatchService.syncBatchQuantity(batch.id, tx);
          created.push(mov);
        }

        return created;
      });

      for (const movement of movements) {
        if (movement.batchId) {
          await BatchService.syncBatchAlerts(movement.batchId);
        }
      }

      const totalQuantity = movements.reduce((sum, m) => sum + m.quantity, 0);

      return {
        movements,
        totalQuantity,
        batchCount: movements.length,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes('validade')) {
        throw new ValidationError(e.message);
      }
      throw e;
    }
  }

  private static async updateStockInTx(
    tx: Prisma.TransactionClient,
    productId: string,
    locationId: string,
    batchId: string | null | undefined,
    quantityDelta: number
  ) {
    const batchKey = batchId ?? null;
    const existing = await tx.stockItem.findFirst({
      where: { productId, locationId, batchId: batchKey },
    });

    if (existing) {
      const newQty = existing.quantity + quantityDelta;
      if (newQty < 0) throw new ValidationError('Quantidade insuficiente em estoque');
      await tx.stockItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    } else if (quantityDelta > 0) {
      await tx.stockItem.create({
        data: { productId, locationId, batchId: batchKey, quantity: quantityDelta },
      });
    } else {
      throw new ValidationError('Item não encontrado no estoque');
    }
  }

  static async createExit(data: ExitDTO, userId: string) {
    if (data.type !== 'SAIDA_VENCIMENTO' && data.batchId) {
      const batch = await prisma.productBatch.findUnique({ where: { id: data.batchId } });
      if (batch?.status === 'EXPIRED') {
        throw new ValidationError('Não é permitido saída de lote vencido (exceto baixa por vencimento)');
      }
    }

    if (data.batchId) {
      const item = await prisma.stockItem.findFirst({
        where: {
          productId: data.productId,
          locationId: data.originLocationId,
          batchId: data.batchId,
        },
      });
      if (!item || item.quantity < data.quantity) {
        throw new ValidationError('Quantidade insuficiente no lote selecionado');
      }

      return prisma.$transaction(async (tx) => {
        const mov = await tx.stockMovement.create({
          data: {
            type: data.type,
            status: 'CONCLUIDA',
            productId: data.productId,
            batchId: data.batchId,
            quantity: data.quantity,
            originLocationId: data.originLocationId,
            reason: data.reason,
            notes: data.notes,
            movementDate: data.movementDate ? new Date(data.movementDate) : new Date(),
            userId,
          },
          include: { product: true, originLocation: true, batch: true, user: { select: { name: true } } },
        });
        await this.updateStockInTx(tx, data.productId, data.originLocationId, data.batchId, -data.quantity);
        await BatchService.syncBatchQuantity(data.batchId!, tx);
        return mov;
      });
    }

    const fefoPlan = await BatchService.getFefoBatches(
      data.productId,
      data.originLocationId,
      data.quantity
    );

    return prisma.$transaction(async (tx) => {
      const movements = [];
      for (const slice of fefoPlan) {
        const mov = await tx.stockMovement.create({
          data: {
            type: data.type,
            status: 'CONCLUIDA',
            productId: data.productId,
            batchId: slice.batchId,
            quantity: slice.quantity,
            originLocationId: data.originLocationId,
            reason: data.reason || `FEFO - Lote ${slice.batch.batchNumber}`,
            notes: data.notes,
            movementDate: data.movementDate ? new Date(data.movementDate) : new Date(),
            userId,
          },
          include: { product: true, originLocation: true, batch: true, user: { select: { name: true } } },
        });
        await this.updateStockInTx(
          tx,
          data.productId,
          data.originLocationId,
          slice.batchId,
          -slice.quantity
        );
        await BatchService.syncBatchQuantity(slice.batchId, tx);
        movements.push(mov);
      }
      return { ...movements[0], fefoAllocations: movements };
    });
  }

  static async createTransfer(data: TransferDTO, userId: string) {
    const movement = await prisma.stockMovement.create({
      data: {
        type: 'TRANSFERENCIA',
        status: 'PENDENTE',
        productId: data.productId,
        batchId: data.batchId,
        quantity: data.quantity,
        originLocationId: data.originLocationId,
        destinationLocationId: data.destinationLocationId,
        reason: data.reason,
        notes: data.notes,
        movementDate: data.movementDate ? new Date(data.movementDate) : new Date(),
        userId,
      },
      include: {
        product: true,
        originLocation: true,
        destinationLocation: true,
        user: { select: { id: true, name: true } },
      },
    });

    return movement;
  }

  static async approveTransfer(
    id: string,
    approved: boolean,
    approverId: string,
    notes?: string
  ) {
    const movement = await prisma.stockMovement.findUnique({ where: { id } });
    if (!movement || movement.type !== 'TRANSFERENCIA') {
      throw new NotFoundError('Transferência não encontrada');
    }
    if (movement.status !== 'PENDENTE') {
      throw new ValidationError('Transferência já processada');
    }

    if (!approved) {
      return prisma.stockMovement.update({
        where: { id },
        data: {
          status: 'REJEITADA',
          approvedById: approverId,
          approvedAt: new Date(),
          notes: notes || movement.notes,
        },
      });
    }

    return prisma.$transaction(async (tx) => {
      await this.updateStockInTx(
        tx,
        movement.productId,
        movement.originLocationId!,
        movement.batchId,
        -movement.quantity
      );
      await this.updateStockInTx(
        tx,
        movement.productId,
        movement.destinationLocationId!,
        movement.batchId,
        movement.quantity
      );

      return tx.stockMovement.update({
        where: { id },
        data: {
          status: 'APROVADA',
          approvedById: approverId,
          approvedAt: new Date(),
          notes: notes || movement.notes,
        },
        include: {
          product: true,
          originLocation: true,
          destinationLocation: true,
          user: { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
      });
    });
  }

  static async list(filters: Record<string, string | undefined>) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where: Prisma.StockMovementWhereInput = {};

    if (filters.type) where.type = filters.type as MovementType;
    if (filters.status) where.status = filters.status as MovementStatus;
    if (filters.productId) where.productId = filters.productId;
    if (filters.locationId) {
      where.OR = [
        { originLocationId: filters.locationId },
        { destinationLocationId: filters.locationId },
      ];
    }
    if (filters.startDate || filters.endDate) {
      where.movementDate = {};
      if (filters.startDate) where.movementDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.movementDate.lte = new Date(filters.endDate);
    }
    if (filters.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { product: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { movementDate: 'desc' },
        include: {
          product: { select: { id: true, name: true, internalCode: true } },
          originLocation: true,
          destinationLocation: true,
          supplier: true,
          batch: true,
          user: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return buildPaginatedResult(data, total, pagination);
  }

  static async findById(id: string) {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: {
        product: true,
        originLocation: true,
        destinationLocation: true,
        supplier: true,
        batch: true,
        user: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (!movement) throw new NotFoundError('Movimentação não encontrada');
    return movement;
  }

  static getEntryTypes() {
    return ENTRY_TYPES;
  }

  static getExitTypes() {
    return EXIT_TYPES;
  }
}
