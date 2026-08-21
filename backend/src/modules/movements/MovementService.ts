import { MovementStatus, MovementType, Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { z } from 'zod';
import { entrySchema, exitSchema, kitAssemblySchema, transferSchema } from './movements.dto';
import { BatchService } from '../batches/BatchService';
import { calculateExpirationStatus } from '../../shared/utils/expiration';
type EntryDTO = z.infer<typeof entrySchema>;
type ExitDTO = z.infer<typeof exitSchema>;
type KitAssemblyDTO = z.infer<typeof kitAssemblySchema>;
type TransferDTO = z.infer<typeof transferSchema>;
type PendingEntryMetadata = {
  kind: 'ENTRY';
  batchNumber: string;
  expirationDate: string;
  manufacturingDate: string;
  unitPrice?: number;
};
type PendingKitAssemblyMetadata = {
  kind: 'KIT_ASSEMBLY';
  batchNumber: string;
  expirationDate: string;
  manufacturingDate: string;
  components: NonNullable<KitAssemblyDTO['components']>;
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
type MovementCategory = 'entry' | 'exit' | 'transfer';
const MOVEMENT_CATEGORY_TYPES: Record<MovementCategory, MovementType[]> = {
  entry: ENTRY_TYPES,
  exit: EXIT_TYPES,
  transfer: ['TRANSFERENCIA'],
};
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
  private static requiresApproval(roleName?: RoleName): boolean {
    return roleName === ('OPERACIONAL' satisfies RoleName);
  }
  private static async requireActiveProduct(productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Produto não encontrado');
    if (!product.active) {
      throw new ValidationError('Produto inativo não pode ser usado em movimentações');
    }
    return product;
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

  /** Plano de baixa dos componentes de um kit no local informado. */
  private static async planKitComponentExit(
    kitProductId: string,
    originLocationId: string,
    kitQuantity: number,
    exitType: ExitDTO['type'],
    overrides?: NonNullable<ExitDTO['kitComponents']>
  ) {
    type Slice = {
      componentProductId: string;
      componentName: string;
      batchId: string | null;
      quantity: number;
    };

    type Line = {
      componentProductId: string;
      quantity: number;
      batchId?: string | null;
      name: string;
    };

    let lines: Line[];

    if (overrides?.length) {
      lines = [];
      for (const row of overrides) {
        const component = await prisma.product.findUnique({
          where: { id: row.componentProductId },
          select: { id: true, name: true, active: true, productType: true },
        });
        if (!component || !component.active) {
          throw new ValidationError('Produto componente inválido ou inativo');
        }
        if (component.productType === 'KIT') {
          throw new ValidationError(`"${component.name}" é um kit e não pode ser componente da saída`);
        }
        lines.push({
          componentProductId: component.id,
          quantity: row.quantity,
          batchId: row.batchId,
          name: component.name,
        });
      }
    } else {
      const kitItems = await prisma.productKitItem.findMany({
        where: { kitProductId },
        include: {
          componentProduct: { select: { id: true, name: true, active: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (kitItems.length < 2) {
        throw new ValidationError('Kit sem composição válida (mínimo 2 produtos)');
      }
      lines = kitItems.map((item) => ({
        componentProductId: item.componentProductId,
        quantity: item.quantity * kitQuantity,
        batchId: item.batchId,
        name: item.componentProduct.name,
      }));
    }

    if (lines.length < 1) {
      throw new ValidationError('Informe ao menos um produto para a saída do kit');
    }

    const plan: Slice[] = [];

    for (const item of lines) {
      const need = item.quantity;
      const name = item.name;

      if (item.batchId) {
        const stock = await prisma.stockItem.findFirst({
          where: {
            productId: item.componentProductId,
            locationId: originLocationId,
            batchId: item.batchId,
          },
          include: { batch: true },
        });
        if (!stock || stock.quantity < need) {
          throw new ValidationError(
            `Estoque insuficiente no lote selecionado de "${name}" (necessário ${need} un.)`
          );
        }
        if (
          exitType !== 'SAIDA_VENCIMENTO' &&
          stock.batch &&
          calculateExpirationStatus(stock.batch.expirationDate) === 'EXPIRED'
        ) {
          throw new ValidationError(
            `Lote vencido do componente "${name}" — use baixa por vencimento`
          );
        }
        plan.push({
          componentProductId: item.componentProductId,
          componentName: name,
          batchId: item.batchId,
          quantity: need,
        });
        continue;
      }

      const lotCount = await prisma.stockItem.count({
        where: {
          productId: item.componentProductId,
          locationId: originLocationId,
          quantity: { gt: 0 },
          batchId: { not: null },
        },
      });
      if (lotCount > 1) {
        throw new ValidationError(
          `Selecione o lote de "${name}" — há mais de um lote disponível neste local`
        );
      }

      try {
        const fefo = await BatchService.getFefoBatches(
          item.componentProductId,
          originLocationId,
          need
        );
        for (const slice of fefo) {
          plan.push({
            componentProductId: item.componentProductId,
            componentName: name,
            batchId: slice.batchId,
            quantity: slice.quantity,
          });
        }
        continue;
      } catch {
        // tenta saldo sem lote
      }

      const noBatch = await prisma.stockItem.findFirst({
        where: {
          productId: item.componentProductId,
          locationId: originLocationId,
          batchId: null,
        },
      });
      if (!noBatch || noBatch.quantity < need) {
        throw new ValidationError(
          `Estoque insuficiente para o componente "${name}" (necessário ${need} un. no local selecionado)`
        );
      }
      plan.push({
        componentProductId: item.componentProductId,
        componentName: name,
        batchId: null,
        quantity: need,
      });
    }

    return plan;
  }

  private static async executeKitExit(
    data: ExitDTO,
    userId: string,
    plan: Awaited<ReturnType<typeof MovementService.planKitComponentExit>>
  ) {
    const movementDate = data.movementDate ? new Date(data.movementDate) : new Date();
    const kitLabel = data.reason?.trim() || 'Saída de kit';

    return prisma.$transaction(async (tx) => {
      const header = await tx.stockMovement.create({
        data: {
          type: data.type,
          status: 'CONCLUIDA',
          productId: data.productId,
          quantity: data.quantity,
          originLocationId: data.originLocationId,
          reason: data.reason,
          notes: data.notes,
          movementDate,
          userId,
          metadata: {
            kind: 'KIT_EXIT',
            componentCount: plan.length,
          },
        },
        include: movementInclude,
      });

      const componentMovements = [];
      for (const slice of plan) {
        const mov = await tx.stockMovement.create({
          data: {
            type: data.type,
            status: 'CONCLUIDA',
            productId: slice.componentProductId,
            batchId: slice.batchId,
            quantity: slice.quantity,
            originLocationId: data.originLocationId,
            reason: `${kitLabel} — componente de kit`,
            notes: data.notes
              ? `${data.notes} | kitMovementId=${header.id}`
              : `kitMovementId=${header.id}`,
            movementDate,
            userId,
            metadata: {
              kind: 'KIT_EXIT_COMPONENT',
              kitProductId: data.productId,
              kitMovementId: header.id,
            },
          },
          include: movementInclude,
        });
        await this.updateStockInTx(
          tx,
          slice.componentProductId,
          data.originLocationId,
          slice.batchId,
          -slice.quantity
        );
        if (slice.batchId) {
          await BatchService.syncBatchQuantity(slice.batchId, tx);
        }
        componentMovements.push(mov);
      }

      return {
        ...header,
        kitComponents: componentMovements,
      };
    });
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
  static async createEntry(data: EntryDTO, userId: string, roleName?: RoleName) {
    if (this.requiresApproval(roleName)) {
      return this.createPendingEntry(data, userId);
    }
    return this.executeEntry(data, userId);
  }
  private static async createPendingEntry(data: EntryDTO, userId: string) {
    const product = await this.requireActiveProduct(data.productId);
    if (product.productType === 'KIT') {
      throw new ValidationError(
        'Kits não recebem entrada direta — use Montagem de kit para gerar o estoque'
      );
    }
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
    const product = await this.requireActiveProduct(data.productId);
    if (product.productType === 'KIT') {
      throw new ValidationError(
        'Kits não recebem entrada direta — use Montagem de kit para gerar o estoque'
      );
    }
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

  static async createKitAssembly(data: KitAssemblyDTO, userId: string, roleName?: RoleName) {
    const kit = await this.requireActiveProduct(data.kitProductId);
    if (kit.productType !== 'KIT') {
      throw new ValidationError('O produto selecionado não é um kit');
    }

    const plan = await this.planKitComponentExit(
      data.kitProductId,
      data.destinationLocationId,
      data.quantity,
      'SAIDA_CONSUMO',
      data.components
    );

    if (this.requiresApproval(roleName)) {
      const manufacturingDate =
        data.manufacturingDate?.trim() || new Date().toISOString().slice(0, 10);
      const metadata: PendingKitAssemblyMetadata = {
        kind: 'KIT_ASSEMBLY',
        batchNumber: data.batchNumber.trim(),
        expirationDate: data.expirationDate,
        manufacturingDate,
        components: data.components,
      };
      const movement = await prisma.stockMovement.create({
        data: {
          type: 'ENTRADA_MANUAL',
          status: 'PENDENTE',
          productId: data.kitProductId,
          quantity: data.quantity,
          destinationLocationId: data.destinationLocationId,
          reason: data.reason || 'Montagem de kit',
          notes: data.notes,
          movementDate: data.movementDate ? new Date(data.movementDate) : new Date(),
          userId,
          metadata,
        },
        include: movementInclude,
      });
      return { ...movement, pendingApproval: true };
    }

    return this.executeKitAssembly(data, userId, plan);
  }

  private static async executeKitAssembly(
    data: KitAssemblyDTO,
    userId: string,
    plan: Awaited<ReturnType<typeof MovementService.planKitComponentExit>>,
    options?: { pendingMovementId?: string; approverId?: string }
  ) {
    const movementDate = data.movementDate ? new Date(data.movementDate) : new Date();
    const manufacturingDate = data.manufacturingDate?.trim()
      ? new Date(data.manufacturingDate)
      : new Date();
    const expirationDate = new Date(data.expirationDate);
    const reason = data.reason?.trim() || 'Montagem de kit';

    try {
      const result = await prisma.$transaction(async (tx) => {
        for (const slice of plan) {
          await this.updateStockInTx(
            tx,
            slice.componentProductId,
            data.destinationLocationId,
            slice.batchId,
            -slice.quantity
          );
          if (slice.batchId) {
            await BatchService.syncBatchQuantity(slice.batchId, tx);
          }
        }

        const kitBatch = await BatchService.findOrCreateForEntry(tx, {
          productId: data.kitProductId,
          stockLocationId: data.destinationLocationId,
          batchNumber: data.batchNumber.trim(),
          expirationDate,
          manufacturingDate,
          quantity: data.quantity,
          userId,
        });

        let header;
        if (options?.pendingMovementId) {
          header = await tx.stockMovement.update({
            where: { id: options.pendingMovementId },
            data: {
              status: 'CONCLUIDA',
              batchId: kitBatch.id,
              approvedById: options.approverId,
              approvedAt: new Date(),
              notes: data.notes,
              metadata: {
                kind: 'KIT_ASSEMBLY',
                componentCount: plan.length,
              },
            },
            include: movementInclude,
          });
        } else {
          header = await tx.stockMovement.create({
            data: {
              type: 'ENTRADA_MANUAL',
              status: 'CONCLUIDA',
              productId: data.kitProductId,
              batchId: kitBatch.id,
              quantity: data.quantity,
              destinationLocationId: data.destinationLocationId,
              reason,
              notes: data.notes,
              movementDate,
              userId,
              metadata: {
                kind: 'KIT_ASSEMBLY',
                componentCount: plan.length,
              },
            },
            include: movementInclude,
          });
        }

        await this.updateStockInTx(
          tx,
          data.kitProductId,
          data.destinationLocationId,
          kitBatch.id,
          data.quantity
        );
        await BatchService.syncBatchQuantity(kitBatch.id, tx);

        const componentMovements = [];
        for (const slice of plan) {
          const mov = await tx.stockMovement.create({
            data: {
              type: 'SAIDA_CONSUMO',
              status: 'CONCLUIDA',
              productId: slice.componentProductId,
              batchId: slice.batchId,
              quantity: slice.quantity,
              originLocationId: data.destinationLocationId,
              reason: `${reason} — componente`,
              notes: data.notes
                ? `${data.notes} | kitAssemblyId=${header.id}`
                : `kitAssemblyId=${header.id}`,
              movementDate,
              userId,
              approvedById: options?.approverId,
              approvedAt: options?.approverId ? new Date() : undefined,
              metadata: {
                kind: 'KIT_ASSEMBLY_COMPONENT',
                kitProductId: data.kitProductId,
                kitAssemblyId: header.id,
              },
            },
            include: movementInclude,
          });
          componentMovements.push(mov);
        }

        return { header, kitBatchId: kitBatch.id, componentMovements };
      });

      await BatchService.syncBatchAlerts(result.kitBatchId);
      for (const slice of plan) {
        if (slice.batchId) {
          await BatchService.syncBatchAlerts(slice.batchId);
        }
      }

      return {
        ...result.header,
        kitComponents: result.componentMovements,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes('validade')) {
        throw new ValidationError(e.message);
      }
      throw e;
    }
  }

  static async createExit(data: ExitDTO, userId: string, roleName?: RoleName) {
    const product = await this.requireActiveProduct(data.productId);

    if (product.productType === 'KIT') {
      if (data.batchId) {
        throw new ValidationError(
          'Saída de kit não utiliza lote do kit — a baixa é nos componentes'
        );
      }
      const plan = await this.planKitComponentExit(
        data.productId,
        data.originLocationId,
        data.quantity,
        data.type,
        data.kitComponents
      );
      if (this.requiresApproval(roleName)) {
        const movement = await prisma.stockMovement.create({
          data: {
            type: data.type,
            status: 'PENDENTE',
            productId: data.productId,
            quantity: data.quantity,
            originLocationId: data.originLocationId,
            reason: data.reason,
            notes: data.notes,
            movementDate: data.movementDate ? new Date(data.movementDate) : new Date(),
            userId,
            metadata: {
              kind: 'KIT_EXIT',
              kitComponents: data.kitComponents ?? null,
            },
          },
          include: movementInclude,
        });
        return { ...movement, pendingApproval: true };
      }
      return this.executeKitExit(data, userId, plan);
    }

    await this.assertExitStockAvailable(data);
    if (this.requiresApproval(roleName)) {
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
  static async createTransfer(data: TransferDTO, userId: string, roleName?: RoleName) {
    await this.requireActiveProduct(data.productId);
    await this.assertTransferStockAvailable(data);
    if (this.requiresApproval(roleName)) {
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
    const rawMeta = movement.metadata as
      | PendingEntryMetadata
      | PendingKitAssemblyMetadata
      | null;

    if (rawMeta?.kind === 'KIT_ASSEMBLY') {
      if (!movement.destinationLocationId) {
        throw new ValidationError('Local da montagem pendente inválido');
      }
      const data: KitAssemblyDTO = {
        kitProductId: movement.productId,
        destinationLocationId: movement.destinationLocationId,
        quantity: movement.quantity,
        batchNumber: rawMeta.batchNumber,
        expirationDate: rawMeta.expirationDate,
        manufacturingDate: rawMeta.manufacturingDate,
        reason: movement.reason ?? undefined,
        notes: notes || movement.notes || undefined,
        components: rawMeta.components,
      };
      const plan = await this.planKitComponentExit(
        data.kitProductId,
        data.destinationLocationId,
        data.quantity,
        'SAIDA_CONSUMO',
        data.components
      );
      return this.executeKitAssembly(data, movement.userId, plan, {
        pendingMovementId: movement.id,
        approverId,
      });
    }

    const meta = rawMeta as PendingEntryMetadata | null;
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

    const meta = movement.metadata as {
      kind?: string;
      kitComponents?: NonNullable<ExitDTO['kitComponents']>;
    } | null;
    const product = await prisma.product.findUnique({
      where: { id: movement.productId },
      select: { productType: true },
    });
    const isKitExit =
      meta?.kind === 'KIT_EXIT' ||
      (product?.productType === 'KIT' && !movement.batchId);

    if (isKitExit) {
      const exitData: ExitDTO = {
        type: movement.type as ExitDTO['type'],
        productId: movement.productId,
        originLocationId: movement.originLocationId,
        quantity: movement.quantity,
        reason: movement.reason ?? undefined,
        notes: notes || movement.notes || undefined,
        kitComponents: meta?.kitComponents,
      };
      const plan = await this.planKitComponentExit(
        movement.productId,
        movement.originLocationId,
        movement.quantity,
        exitData.type,
        exitData.kitComponents
      );
      return prisma.$transaction(async (tx) => {
        const header = await tx.stockMovement.update({
          where: { id: movement.id },
          data: {
            status: 'CONCLUIDA',
            approvedById: approverId,
            approvedAt: new Date(),
            notes: notes || movement.notes,
            metadata: {
              kind: 'KIT_EXIT',
              componentCount: plan.length,
            },
          },
          include: movementInclude,
        });
        for (const slice of plan) {
          await tx.stockMovement.create({
            data: {
              type: movement.type,
              status: 'CONCLUIDA',
              productId: slice.componentProductId,
              batchId: slice.batchId,
              quantity: slice.quantity,
              originLocationId: movement.originLocationId!,
              reason: `${movement.reason || 'Saída de kit'} — componente de kit`,
              notes: `kitMovementId=${header.id}`,
              movementDate: movement.movementDate,
              userId: movement.userId,
              approvedById: approverId,
              approvedAt: new Date(),
              metadata: {
                kind: 'KIT_EXIT_COMPONENT',
                kitProductId: movement.productId,
                kitMovementId: header.id,
              },
            },
          });
          await this.updateStockInTx(
            tx,
            slice.componentProductId,
            movement.originLocationId!,
            slice.batchId,
            -slice.quantity
          );
          if (slice.batchId) {
            await BatchService.syncBatchQuantity(slice.batchId, tx);
          }
        }
        return header;
      });
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
    if (filters.type) {
      where.type = filters.type as MovementType;
    } else if (filters.category && filters.category in MOVEMENT_CATEGORY_TYPES) {
      where.type = { in: MOVEMENT_CATEGORY_TYPES[filters.category as MovementCategory] };
    }
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
          product: { select: { id: true, name: true, internalCode: true, productType: true } },
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

    const meta = movement.metadata as { kind?: string; kitMovementId?: string } | null;
    const isKitExitHeader = meta?.kind === 'KIT_EXIT';
    const reversedBatchIds = new Set<string>();
    if (movement.batchId) reversedBatchIds.add(movement.batchId);

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
      } else if (isKitExitHeader && EXIT_TYPES.includes(movement.type)) {
        const components = await tx.stockMovement.findMany({
          where: {
            AND: [
              { metadata: { path: ['kind'], equals: 'KIT_EXIT_COMPONENT' } },
              { metadata: { path: ['kitMovementId'], equals: movement.id } },
            ],
          },
        });
        for (const component of components) {
          if (!component.originLocationId) {
            throw new ValidationError('Origem da saída do componente não informada');
          }
          await this.updateStockInTx(
            tx,
            component.productId,
            component.originLocationId,
            component.batchId,
            component.quantity
          );
          if (component.batchId) {
            await BatchService.syncBatchQuantity(component.batchId, tx);
            reversedBatchIds.add(component.batchId);
          }
          await tx.stockMovement.delete({ where: { id: component.id } });
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

    for (const batchId of reversedBatchIds) {
      await BatchService.syncBatchAlerts(batchId);
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
