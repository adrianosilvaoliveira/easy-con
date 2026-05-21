import { ExpirationStatus, Prisma } from '@prisma/client';
import { BatchService } from '../batches/BatchService';
import { statusLabel } from '../../shared/utils/expiration';

export type BatchReportFilters = Record<string, string | undefined>;

/** Monta WHERE Prisma para relatórios PDF de vencimento/lotes */
export function buildBatchReportWhere(filters: BatchReportFilters): Prisma.ProductBatchWhereInput {
  const where = BatchService.buildWhere(filters);

  if (filters.onlyExpired === 'true') {
    where.status = 'EXPIRED';
    delete (where.expirationDate as Prisma.DateTimeFilter | undefined)?.gte;
  } else if (filters.onlyExpiring === 'true' || filters.expiringDays) {
    const days = Number(filters.expiringDays) || 90;
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    const from = filters.expirationFrom ? new Date(filters.expirationFrom) : new Date();
    const to = filters.expirationTo ? new Date(filters.expirationTo) : limit;
    where.expirationDate = { gte: from, lte: to };
    where.status = { not: 'EXPIRED' };
  }

  if (filters.includeZeroQuantity !== 'true') {
    where.quantity = { gt: 0 };
  }

  return where;
}

export function buildReportSubtitle(filters: BatchReportFilters): string {
  const parts: string[] = [];

  if (filters.startDate || filters.endDate) {
    parts.push(`Período: ${filters.startDate || '…'} a ${filters.endDate || 'hoje'}`);
  }
  if (filters.expirationFrom || filters.expirationTo) {
    parts.push(`Validade: ${filters.expirationFrom || '…'} a ${filters.expirationTo || '…'}`);
  }
  if (filters.expiringDays) parts.push(`Vencendo em até ${filters.expiringDays} dias`);
  if (filters.onlyExpired === 'true') parts.push('Somente vencidos');
  if (filters.onlyExpiring === 'true') parts.push('Somente a vencer');
  if (filters.status && filters.status in statusLabel) {
    parts.push(`Status: ${statusLabel[filters.status as ExpirationStatus]}`);
  }
  if (filters.batchNumber) parts.push(`Lote: ${filters.batchNumber}`);
  if (filters.productId) parts.push('Filtro: produto');
  if (filters.categoryId) parts.push('Filtro: categoria');
  if (filters.supplierId) parts.push('Filtro: fornecedor');
  if (filters.stockLocationId) parts.push('Filtro: local');

  return parts.length ? parts.join(' · ') : 'Todos os registros (com filtros padrão de estoque ativo)';
}

export const batchReportInclude = {
  product: { include: { category: true } },
  stockLocation: true,
  supplier: true,
} as const;
