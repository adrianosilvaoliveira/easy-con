import { MovementStatus, MovementType, Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { z } from 'zod';
import { entrySchema, exitSchema, transferSchema } from './movements.dto';
import { BatchService } from '../batches/BatchService';
type EntryDTO = z.infer<typeof entrySchema>;
type ExitDTO = z.infer<typeof exitSchema>;
type TransferDTO = z.infer<typeof transferSchema>;
type PendingEntryMetadata = {
  kind: 'ENTRY';
  batchNumber: string;
  expirationDate: string;
  manufacturingDate: string;
  unitPrice?: number;
};
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
const movementInclude = {
  product: true,
  originLocation: true,
  destinationLocation: true,
  supplier: true,
  batch: true,
  user: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
} as const;
export class MovementService {
  private static async requiresApproval(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { name: true } } },
    });
    return user?.role.name === ('OPERACIONAL' satisfies RoleName);
  }
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
      if (newQty === 0) {
        await prisma.stockItem.delete({ where: { id: existing.id } });
      } else {
        await prisma.stockItem.update({
          where: { id: existing.id },
          data: { quantity: newQty },
        });
      }
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
      if (newQty === 0) {
        await tx.stockItem.delete({ where: { id: existing.id } });
      } else {
        await tx.stockItem.update({
          where: { id: existing.id },
          data: { quantity: newQty },
        });
      }
    } else if (quantityDelta > 0) {
      await tx.stockItem.create({
        data: { productId, locationId, batchId: batchKey, quantity: quantityDelta },
      });
    } else {
      throw new ValidationError('Item não encontrado no estoque');
    }
  }
  private static async assertExitStockAvailable(data: ExitDTO) {
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
      return;
    }
    await BatchService.getFefoBatches(data.productId, data.originLocationId, data.quantity);
  }
  private static async assertTransferStockAvailable(data: TransferDTO) {
    if (data.batchId) {
      const item = await prisma.stockItem.findFirst({
        where: {
          productId: data.productId,
          locationId: data.originLocationId,
          batchId: data.batchId,
        },
      });
      if (!item || item.quantity < data.quantity) {
        throw new ValidationError('Quantidade insuficiente no estoque de origem');
      }
      return;
    }
    await BatchService.getFefoBatches(data.productId, data.originLocationId, data.quantity);
  }
  static async createEntry(data: EntryDTO, userId: string) {
    if (await this.requiresApproval(userId)) {
      return this.createPendingEntry(data, userId);
    }
    return this.executeEntry(data, userId);
  }
  private static async createPendingEntry(data: EntryDTO, userId: string) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new NotFoundError('Produto não encontrado');
    const movementDate = data.movementDate ? new Date(data.movementDate) : new Date();
    const movements = [];
    for (const line of data.batches) {
      const metadata: PendingEntryMetadata = {
        kind: 'ENTRY',
        batchNumber: line.batchNumber.trim(),
        expirationDate: line.expirationDate,
        manufacturingDate: line.manufacturingDate,
        unitPrice: line.unitPrice,
      };
      const mov = await prisma.stockMovement.create({
        data: {
          type: data.type,
          status: 'PENDENTE',
          productId: data.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice ? new Prisma.Decimal(line.unitPrice) : undefined,
          totalValue: line.unitPrice
            ? new Prisma.Decimal(line.unitPrice * line.quantity)
            : undefined,
          destinationLocationId: data.destinationLocationId,
          supplierId: data.supplierId,
          invoiceNumber: data.invoiceNumber,
          reason: data.reason,
          notes: data.notes,
          movementDate,
          userId,
          metadata,
        },
        include: movementInclude,
      });
      movements.push(mov);
    }
    return {
      movements,
      totalQuantity: movements.reduce((sum, m) => sum + m.quantity, 0),
      batchCount: movements.length,
      pendingApproval: true,
    };
  }
  private static async executeEntry(data: EntryDTO, userId: string) {
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
            include: movementInclude,
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
      return {
        movements,
        totalQuantity: movements.reduce((sum, m) => sum + m.quantity, 0),
        batchCount: movements.length,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes('validade')) {
        throw new ValidationError(e.message);
      }
      throw e;
    }
  }
  static async createExit(data: ExitDTO, userId: string) {
    await this.assertExitStockAvailable(data);
    if (await this.requiresApproval(userId)) {
      return this.createPendingExit(data, userId);
    }
    return this.executeExit(data, userId);
  }
  private static async createPendingExit(data: ExitDTO, userId: string) {
    const movement = await prisma.stockMovement.create({
      data: {
        type: data.type,
        status: 'PENDENTE',
        productId: data.productId,
        batchId: data.batchId,
        quantity: data.quantity,
        originLocationId: data.originLocationId,
        reason: data.reason,
        notes: data.notes,
        movementDate: data.movementDate ? new Date(data.movementDate) : new Date(),
        userId,
        metadata: { kind: 'EXIT' },
      },
      include: movementInclude,
    });
    return { ...movement, pendingApproval: true };
  }
  private static async executeExit(data: ExitDTO, userId: string) {
    if (data.batchId) {
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
          include: movementInclude,
        });
        await this.updateStockInTx(
          tx,
          data.productId,
          data.originLocationId,
          data.batchId,
          -data.quantity
        );
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
          include: movementInclude,
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
    await this.assertTransferStockAvailable(data);
    if (await this.requiresApproval(userId)) {
      return prisma.stockMovement.create({
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
        include: movementInclude,
      });
    }
    return this.executeTransfer(data, userId);
  }
  private static async executeTransfer(data: TransferDTO, userId: string) {
    const movementDate = data.movementDate ? new Date(data.movementDate) : new Date();
    const approvedAt = new Date();
    if (data.batchId) {
      return prisma.$transaction(async (tx) => {
        await this.updateStockInTx(
          tx,
          data.productId,
          data.originLocationId,
          data.batchId,
          -data.quantity
        );
        await this.updateStockInTx(
          tx,
          data.productId,
          data.destinationLocationId,
          data.batchId,
          data.quantity
        );
        return tx.stockMovement.create({
          data: {
            type: 'TRANSFERENCIA',
            status: 'APROVADA',
            productId: data.productId,
            batchId: data.batchId,
            quantity: data.quantity,
            originLocationId: data.originLocationId,
            destinationLocationId: data.destinationLocationId,
            reason: data.reason,
            notes: data.notes,
            movementDate,
            userId,
            approvedById: userId,
            approvedAt,
          },
          include: movementInclude,
        });
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
            type: 'TRANSFERENCIA',
            status: 'APROVADA',
            productId: data.productId,
            batchId: slice.batchId,
            quantity: slice.quantity,
            originLocationId: data.originLocationId,
            destinationLocationId: data.destinationLocationId,
            reason: data.reason || `FEFO - Lote ${slice.batch.batchNumber}`,
            notes: data.notes,
            movementDate,
            userId,
            approvedById: userId,
            approvedAt,
          },
          include: movementInclude,
        });
        await this.updateStockInTx(
          tx,
          data.productId,
          data.originLocationId,
          slice.batchId,
          -slice.quantity
        );
        await this.updateStockInTx(
          tx,
          data.productId,
          data.destinationLocationId,
          slice.batchId,
          slice.quantity
        );
        await BatchService.syncBatchQuantity(slice.batchId, tx);
        movements.push(mov);
      }
      return { ...movements[0], fefoAllocations: movements };
    });
  }
  static async approveMovement(
    id: string,
    approved: boolean,
    approverId: string,
    notes?: string
  ) {
    const movement = await prisma.stockMovement.findUnique({ where: { id } });
    if (!movement) throw new NotFoundError('Movimentação não encontrada');
    if (movement.status !== 'PENDENTE') {
      throw new ValidationError('Movimentação já processada');
    }
    if (ENTRY_TYPES.includes(movement.type)) {
      return this.approveEntry(movement, approved, approverId, notes);
    }
    if (EXIT_TYPES.includes(movement.type)) {
      return this.approveExit(movement, approved, approverId, notes);
    }
    if (movement.type === 'TRANSFERENCIA') {
      return this.finalizeTransfer(movement, approved, approverId, notes);
    }
    throw new ValidationError('Tipo de movimentação não suportado para aprovação');
  }
  /** @deprecated use approveMovement */
  static async approveTransfer(
    id: string,
    approved: boolean,
    approverId: string,
    notes?: string
  ) {
    return this.approveMovement(id, approved, approverId, notes);
  }
  private static async rejectMovement(
    id: string,
    approverId: string,
    notes: string | undefined,
    currentNotes: string | null
  ) {
    return prisma.stockMovement.update({
      where: { id },
      data: {
        status: 'REJEITADA',
        approvedById: approverId,
        approvedAt: new Date(),
        notes: notes || currentNotes,
      },
      include: movementInclude,
    });
  }
  private static async approveEntry(
    movement: Prisma.StockMovementGetPayload<object>,
    approved: boolean,
    approverId: string,
    notes?: string
  ) {
    if (!approved) {
      return this.rejectMovement(movement.id, approverId, notes, movement.notes);
    }
    const meta = movement.metadata as PendingEntryMetadata | null;
    if (!meta || meta.kind !== 'ENTRY' || !movement.destinationLocationId) {
      throw new ValidationError('Dados da entrada pendente inválidos');
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const batch = await BatchService.findOrCreateForEntry(tx, {
          productId: movement.productId,
          stockLocationId: movement.destinationLocationId!,
          batchNumber: meta.batchNumber,
          expirationDate: new Date(meta.expirationDate),
          manufacturingDate: new Date(meta.manufacturingDate),
          quantity: movement.quantity,
          supplierId: movement.supplierId ?? undefined,
          unitCost: meta.unitPrice,
          userId: movement.userId,
        });
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.destinationLocationId!,
          batch.id,
          movement.quantity
        );
        await BatchService.syncBatchQuantity(batch.id, tx);
        return tx.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: 'CONCLUIDA',
            batchId: batch.id,
            approvedById: approverId,
            approvedAt: new Date(),
            notes: notes || movement.notes,
          },
          include: movementInclude,
        });
      });
      if (result.batchId) {
        await BatchService.syncBatchAlerts(result.batchId);
      }
      return result;
    } catch (e) {
      if (e instanceof Error && e.message.includes('validade')) {
        throw new ValidationError(e.message);
      }
      throw e;
    }
  }
  private static async approveExit(
    movement: Prisma.StockMovementGetPayload<object>,
    approved: boolean,
    approverId: string,
    notes?: string
  ) {
    if (!approved) {
      return this.rejectMovement(movement.id, approverId, notes, movement.notes);
    }
    if (!movement.originLocationId) {
      throw new ValidationError('Origem da saída não informada');
    }
    const exitData: ExitDTO = {
      type: movement.type as ExitDTO['type'],
      productId: movement.productId,
      originLocationId: movement.originLocationId,
      quantity: movement.quantity,
      batchId: movement.batchId ?? undefined,
      reason: movement.reason ?? undefined,
      notes: movement.notes ?? undefined,
    };
    await this.assertExitStockAvailable(exitData);
    if (exitData.batchId) {
      return prisma.$transaction(async (tx) => {
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.originLocationId!,
          exitData.batchId,
          -movement.quantity
        );
        await BatchService.syncBatchQuantity(exitData.batchId!, tx);
        return tx.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: 'CONCLUIDA',
            approvedById: approverId,
            approvedAt: new Date(),
            notes: notes || movement.notes,
          },
          include: movementInclude,
        });
      });
    }
    const fefoPlan = await BatchService.getFefoBatches(
      movement.productId,
      movement.originLocationId,
      movement.quantity
    );
    return prisma.$transaction(async (tx) => {
      let first = true;
      let primary = null;
      for (const slice of fefoPlan) {
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.originLocationId!,
          slice.batchId,
          -slice.quantity
        );
        await BatchService.syncBatchQuantity(slice.batchId, tx);
        if (first) {
          primary = await tx.stockMovement.update({
            where: { id: movement.id },
            data: {
              status: 'CONCLUIDA',
              batchId: slice.batchId,
              quantity: slice.quantity,
              reason: movement.reason || `FEFO - Lote ${slice.batch.batchNumber}`,
              approvedById: approverId,
              approvedAt: new Date(),
              notes: notes || movement.notes,
            },
            include: movementInclude,
          });
          first = false;
        } else {
          await tx.stockMovement.create({
            data: {
              type: movement.type,
              status: 'CONCLUIDA',
              productId: movement.productId,
              batchId: slice.batchId,
              quantity: slice.quantity,
              originLocationId: movement.originLocationId!,
              reason: movement.reason || `FEFO - Lote ${slice.batch.batchNumber}`,
              notes: movement.notes,
              movementDate: movement.movementDate,
              userId: movement.userId,
              approvedById: approverId,
              approvedAt: new Date(),
            },
          });
        }
      }
      return primary!;
    });
  }
  private static async finalizeTransfer(
    movement: Prisma.StockMovementGetPayload<object>,
    approved: boolean,
    approverId: string,
    notes?: string
  ) {
    if (!approved) {
      return this.rejectMovement(movement.id, approverId, notes, movement.notes);
    }
    if (!movement.originLocationId || !movement.destinationLocationId) {
      throw new ValidationError('Origem e destino são obrigatórios');
    }
    const transferData: TransferDTO = {
      type: 'TRANSFERENCIA',
      productId: movement.productId,
      originLocationId: movement.originLocationId,
      destinationLocationId: movement.destinationLocationId,
      quantity: movement.quantity,
      batchId: movement.batchId ?? undefined,
      reason: movement.reason ?? undefined,
      notes: movement.notes ?? undefined,
    };
    await this.assertTransferStockAvailable(transferData);
    if (transferData.batchId) {
      return prisma.$transaction(async (tx) => {
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.originLocationId!,
          transferData.batchId,
          -movement.quantity
        );
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.destinationLocationId!,
          transferData.batchId,
          movement.quantity
        );
        return tx.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: 'APROVADA',
            approvedById: approverId,
            approvedAt: new Date(),
            notes: notes || movement.notes,
          },
          include: movementInclude,
        });
      });
    }
    const fefoPlan = await BatchService.getFefoBatches(
      movement.productId,
      movement.originLocationId,
      movement.quantity
    );
    return prisma.$transaction(async (tx) => {
      let first = true;
      let primary = null;
      for (const slice of fefoPlan) {
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.originLocationId!,
          slice.batchId,
          -slice.quantity
        );
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.destinationLocationId!,
          slice.batchId,
          slice.quantity
        );
        await BatchService.syncBatchQuantity(slice.batchId, tx);
        if (first) {
          primary = await tx.stockMovement.update({
            where: { id: movement.id },
            data: {
              status: 'APROVADA',
              batchId: slice.batchId,
              quantity: slice.quantity,
              reason: movement.reason || `FEFO - Lote ${slice.batch.batchNumber}`,
              approvedById: approverId,
              approvedAt: new Date(),
              notes: notes || movement.notes,
            },
            include: movementInclude,
          });
          first = false;
        } else {
          await tx.stockMovement.create({
            data: {
              type: 'TRANSFERENCIA',
              status: 'APROVADA',
              productId: movement.productId,
              batchId: slice.batchId,
              quantity: slice.quantity,
              originLocationId: movement.originLocationId!,
              destinationLocationId: movement.destinationLocationId!,
              reason: movement.reason || `FEFO - Lote ${slice.batch.batchNumber}`,
              notes: movement.notes,
              movementDate: movement.movementDate,
              userId: movement.userId,
              approvedById: approverId,
              approvedAt: new Date(),
            },
          });
        }
      }
      return primary!;
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

  static async delete(id: string) {
    const movement = await prisma.stockMovement.findUnique({ where: { id } });
    if (!movement) throw new NotFoundError('Movimentação não encontrada');

    const reversible = movement.status === 'CONCLUIDA' || movement.status === 'APROVADA';
    const removable = movement.status === 'PENDENTE' || movement.status === 'REJEITADA';

    if (!reversible && !removable) {
      throw new ValidationError('Esta movimentação não pode ser excluída');
    }

    if (removable) {
      await prisma.stockMovement.delete({ where: { id } });
      return { message: 'Movimentação excluída' };
    }

    await prisma.$transaction(async (tx) => {
      if (ENTRY_TYPES.includes(movement.type)) {
        if (!movement.destinationLocationId) {
          throw new ValidationError('Destino da entrada não informado');
        }
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.destinationLocationId,
          movement.batchId,
          -movement.quantity
        );
        if (movement.batchId) {
          await BatchService.syncBatchQuantity(movement.batchId, tx);
        }
      } else if (EXIT_TYPES.includes(movement.type)) {
        if (!movement.originLocationId) {
          throw new ValidationError('Origem da saída não informada');
        }
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.originLocationId,
          movement.batchId,
          movement.quantity
        );
        if (movement.batchId) {
          await BatchService.syncBatchQuantity(movement.batchId, tx);
        }
      } else if (movement.type === 'TRANSFERENCIA') {
        if (!movement.originLocationId || !movement.destinationLocationId) {
          throw new ValidationError('Origem ou destino da transferência não informado');
        }
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.originLocationId,
          movement.batchId,
          movement.quantity
        );
        await this.updateStockInTx(
          tx,
          movement.productId,
          movement.destinationLocationId,
          movement.batchId,
          -movement.quantity
        );
        if (movement.batchId) {
          await BatchService.syncBatchQuantity(movement.batchId, tx);
        }
      } else {
        throw new ValidationError('Tipo de movimentação não suportado para exclusão');
      }

      await tx.stockMovement.delete({ where: { id } });
    });

    if (movement.batchId) {
      await BatchService.syncBatchAlerts(movement.batchId);
    }

    return { message: 'Movimentação excluída e estoque estornado' };
  }

  static getEntryTypes() {
    return ENTRY_TYPES;
  }
  static getExitTypes() {
    return EXIT_TYPES;
  }
}
