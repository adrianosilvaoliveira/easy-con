import { z } from 'zod';
import { MovementType } from '@prisma/client';

/** Trata campos opcionais "vazios" (""/null) como ausentes antes de coagir para número. */
const emptyToUndefined = (value: unknown) =>
  value === '' || value === null ? undefined : value;

/** Máximo para valor unitário (R$ 100.000,00). */
const MAX_UNIT_PRICE = 100_000;

const optionalPositiveNumber = z.preprocess(
  emptyToUndefined,
  z.coerce.number().positive().max(MAX_UNIT_PRICE, 'Máximo R$ 100.000,00').optional()
);

const optionalUuid = z.preprocess(emptyToUndefined, z.string().uuid().optional());

const baseMovement = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: optionalPositiveNumber,
  reason: z.string().optional(),
  notes: z.string().optional(),
  movementDate: z.string().datetime().optional(),
});

const entryBatchLineSchema = z.object({
  batchNumber: z.string().min(1, 'Número do lote obrigatório'),
  expirationDate: z.string().min(1, 'Data de validade obrigatória'),
  manufacturingDate: z.string().min(1, 'Data de fabricação obrigatória'),
  quantity: z.coerce.number().int().positive('Quantidade deve ser maior que zero'),
  unitPrice: optionalPositiveNumber,
});

export const entrySchema = z
  .object({
    type: z.enum([
      'ENTRADA_COMPRA',
      'ENTRADA_MANUAL',
      'AJUSTE_ENTRADA',
      'DEVOLUCAO',
    ]),
    productId: z.string().uuid(),
    destinationLocationId: z.string().uuid(),
    supplierId: optionalUuid,
    invoiceNumber: z.string().optional(),
    reason: z.string().optional(),
    notes: z.string().optional(),
    movementDate: z.string().datetime().optional(),
    batches: z
      .array(entryBatchLineSchema)
      .min(1, 'Informe ao menos um lote')
      .max(50, 'Máximo de 50 lotes por entrada'),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < data.batches.length; i++) {
      const key = data.batches[i].batchNumber.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Número de lote duplicado na mesma entrada',
          path: ['batches', i, 'batchNumber'],
        });
      }
      seen.add(key);
    }
  });

export const exitSchema = baseMovement.extend({
  type: z.enum([
    'SAIDA_CONSUMO',
    'SAIDA_CIRURGIA',
    'SAIDA_CONSULTA',
    'SAIDA_PERDA',
    'SAIDA_VENCIMENTO',
  ]),
  originLocationId: z.string().uuid(),
  /** @deprecated Saída de kit agora baixa o lote do kit montado; mantido só para pendências antigas. */
  kitComponents: z
    .array(
      z.object({
        componentProductId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
        batchId: optionalUuid,
      })
    )
    .min(1, 'Informe ao menos um produto na saída do kit')
    .max(50)
    .optional(),
});

/** Montagem: baixa componentes e gera estoque/lote do kit acabado. */
export const kitAssemblySchema = z.object({
  kitProductId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  batchNumber: z.string().min(1, 'Número do lote do kit obrigatório'),
  expirationDate: z.string().min(1, 'Data de validade obrigatória'),
  manufacturingDate: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  movementDate: z.string().datetime().optional(),
  components: z
    .array(
      z.object({
        componentProductId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
        batchId: optionalUuid,
      })
    )
    .min(1, 'Informe os componentes da montagem')
    .max(50),
});

export const transferSchema = baseMovement.extend({
  type: z.literal('TRANSFERENCIA'),
  originLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
});

export const approveMovementSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

/** @deprecated use approveMovementSchema */
export const approveTransferSchema = approveMovementSchema;

export const listMovementsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  type: z.nativeEnum(MovementType).optional(),
  status: z.string().optional(),
  productId: z.string().optional(),
  locationId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});
