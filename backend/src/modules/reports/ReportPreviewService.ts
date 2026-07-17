import { prisma } from '../../database/prisma';
import { MovementType } from '@prisma/client';
import {
  batchReportInclude,
  buildBatchReportWhere,
  buildReportSubtitle,
  type BatchReportFilters,
} from './batchReportFilters';
import { statusLabel } from '../../shared/utils/expiration';
import type { ReportPreview } from './report.types';

const ENTRY_TYPES: MovementType[] = [
  'ENTRADA_COMPRA',
  'ENTRADA_MANUAL',
  'AJUSTE_ENTRADA',
  'DEVOLUCAO',
];

function preview(
  title: string,
  subtitle: string,
  columns: ReportPreview['columns'],
  rows: Record<string, string | number>[]
): ReportPreview {
  return {
    title,
    subtitle,
    columns,
    rows,
    generatedAt: new Date().toISOString(),
  };
}

function mapBatchRows(
  batches: Array<{
    batchNumber: string;
    expirationDate: Date;
    manufacturingDate: Date | null;
    quantity: number;
    status: 'VALID' | 'WARNING' | 'CRITICAL' | 'EXPIRED';
    unitCost: { toString(): string } | null;
    product: { name: string; internalCode: string; category?: { name: string } | null };
    stockLocation: { name: string };
    supplier?: { name: string } | null;
  }>
) {
  return batches.map((b) => ({
    product: b.product.name,
    code: b.product.internalCode,
    category: b.product.category?.name || '-',
    lot: b.batchNumber,
    location: b.stockLocation.name,
    supplier: b.supplier?.name || '-',
    expiry: b.expirationDate.toLocaleDateString('pt-BR'),
    mfg: b.manufacturingDate?.toLocaleDateString('pt-BR') || '-',
    status: statusLabel[b.status] || b.status,
    qty: b.quantity,
    value: b.unitCost ? `R$ ${(Number(b.unitCost) * b.quantity).toFixed(2)}` : '-',
  }));
}

const REPORT_TYPES = [
  'stock',
  'movements',
  'entries',
  'exits',
  'expiring',
  'expired',
  'batches',
  'by-location',
  'discarded',
  'loss-history',
  'expiration-audit',
  'below-min',
  'audit',
  'consumption',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export function isValidReportType(type: string): type is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(type);
}

export class ReportPreviewService {
  static async getPreview(
    type: ReportType,
    filters: Record<string, string | undefined>
  ): Promise<ReportPreview> {
    switch (type) {
      case 'stock':
        return this.stock();
      case 'movements':
        return this.movements(filters);
      case 'entries':
        return this.entries(filters);
      case 'exits':
        return this.exits(filters);
      case 'expiring':
        return this.expiring(filters as BatchReportFilters);
      case 'expired':
        return this.expired(filters as BatchReportFilters);
      case 'batches':
        return this.batches(filters as BatchReportFilters);
      case 'by-location':
        return this.byLocation(filters as BatchReportFilters);
      case 'discarded':
        return this.discarded(filters as BatchReportFilters);
      case 'loss-history':
        return this.lossHistory(filters as BatchReportFilters);
      case 'expiration-audit':
        return this.expirationAudit(filters as BatchReportFilters);
      case 'below-min':
        return this.belowMin();
      case 'audit':
        return this.audit(filters);
      case 'consumption':
        return this.consumption();
      default:
        throw new Error('Tipo de relatório inválido');
    }
  }

  private static mapStockRows(
    stockItems: Array<{
      quantity: number;
      product: {
        name: string;
        internalCode: string;
        unit: string;
        minQuantity: number;
        category?: { name: string } | null;
      };
      location: { name: string };
      batch?: { batchNumber: string; expirationDate: Date } | null;
    }>
  ) {
    return stockItems.map((item) => ({
      code: item.product.internalCode,
      product: item.product.name,
      category: item.product.category?.name || '-',
      location: item.location.name,
      lot: item.batch?.batchNumber || '-',
      expiry: item.batch?.expirationDate.toLocaleDateString('pt-BR') || '-',
      unit: item.product.unit,
      min: item.product.minQuantity,
      qty: item.quantity,
    }));
  }

  static async stock() {
    const stockItems = await prisma.stockItem.findMany({
      where: {
        quantity: { gt: 0 },
        product: { active: true },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { location: { name: 'asc' } },
        { batch: { expirationDate: 'asc' } },
      ],
      take: 5000,
      include: {
        product: { include: { category: true } },
        location: true,
        batch: true,
      },
    });

    const totalQuantity = stockItems.reduce((sum, item) => sum + item.quantity, 0);

    return preview(
      'Relatório de Estoque Completo',
      `${stockItems.length} item(ns) em estoque · Quantidade total: ${totalQuantity}`,
      [
        { header: 'Código', key: 'code' },
        { header: 'Produto', key: 'product' },
        { header: 'Categoria', key: 'category' },
        { header: 'Local', key: 'location' },
        { header: 'Lote', key: 'lot' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Un.', key: 'unit' },
        { header: 'Mínimo', key: 'min' },
        { header: 'Qtd', key: 'qty' },
      ],
      this.mapStockRows(stockItems)
    );
  }

  static async movements(filters: Record<string, string | undefined>) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(filters.startDate && { movementDate: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { movementDate: { lte: new Date(filters.endDate) } }),
        ...(filters.type && { type: filters.type as MovementType }),
      },
      orderBy: { movementDate: 'desc' },
      take: 500,
      include: {
        product: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    return preview(
      'Relatório de Movimentações',
      `Período: ${filters.startDate || 'Início'} a ${filters.endDate || 'Atual'}`,
      [
        { header: 'Data', key: 'date' },
        { header: 'Tipo', key: 'type' },
        { header: 'Produto', key: 'product' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Usuário', key: 'user' },
      ],
      movements.map((m) => ({
        date: m.movementDate.toLocaleDateString('pt-BR'),
        type: m.type.replace(/_/g, ' '),
        product: m.product.name,
        qty: m.quantity,
        user: m.user.name,
      }))
    );
  }

  static async entries(filters: Record<string, string | undefined>) {
    const entries = await prisma.stockMovement.findMany({
      where: {
        type: { in: ENTRY_TYPES },
        ...(filters.startDate && { movementDate: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { movementDate: { lte: new Date(filters.endDate) } }),
      },
      orderBy: { movementDate: 'desc' },
      take: 500,
      include: { product: true, user: { select: { name: true } } },
    });

    return preview(
      'Relatório de Entradas',
      `Período: ${filters.startDate || 'Início'} a ${filters.endDate || 'Atual'}`,
      [
        { header: 'Data', key: 'date' },
        { header: 'Produto', key: 'product' },
        { header: 'NF', key: 'invoice' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Valor', key: 'value' },
      ],
      entries.map((m) => ({
        date: m.movementDate.toLocaleDateString('pt-BR'),
        product: m.product.name,
        invoice: m.invoiceNumber || '-',
        qty: m.quantity,
        value: m.totalValue ? `R$ ${Number(m.totalValue).toFixed(2)}` : '-',
      }))
    );
  }

  static async exits(filters: Record<string, string | undefined>) {
    const exits = await prisma.stockMovement.findMany({
      where: {
        type: { notIn: [...ENTRY_TYPES, 'TRANSFERENCIA'] },
        ...(filters.startDate && { movementDate: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { movementDate: { lte: new Date(filters.endDate) } }),
      },
      orderBy: { movementDate: 'desc' },
      take: 500,
      include: { product: true, originLocation: true },
    });

    return preview(
      'Relatório de Saídas',
      `Período: ${filters.startDate || 'Início'} a ${filters.endDate || 'Atual'}`,
      [
        { header: 'Data', key: 'date' },
        { header: 'Tipo', key: 'type' },
        { header: 'Produto', key: 'product' },
        { header: 'Origem', key: 'origin' },
        { header: 'Qtd', key: 'qty' },
      ],
      exits.map((m) => ({
        date: m.movementDate.toLocaleDateString('pt-BR'),
        type: m.type.replace(/_/g, ' '),
        product: m.product.name,
        origin: m.originLocation?.name || '-',
        qty: m.quantity,
      }))
    );
  }

  static async expiring(filters: BatchReportFilters) {
    const reportFilters: BatchReportFilters = {
      ...filters,
      onlyExpiring: filters.onlyExpiring ?? 'true',
      onlyExpired: filters.onlyExpired === 'true' ? 'true' : undefined,
    };
    const days = Number(filters.expiringDays) || 90;
    const batches = await prisma.productBatch.findMany({
      where: buildBatchReportWhere(reportFilters),
      orderBy: { expirationDate: 'asc' },
      take: 2000,
      include: batchReportInclude,
    });

    return preview(
      `Produtos Vencendo (${days} dias)`,
      buildReportSubtitle(reportFilters),
      [
        { header: 'Código', key: 'code' },
        { header: 'Produto', key: 'product' },
        { header: 'Categoria', key: 'category' },
        { header: 'Lote', key: 'lot' },
        { header: 'Local', key: 'location' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Status', key: 'status' },
        { header: 'Qtd', key: 'qty' },
      ],
      mapBatchRows(batches)
    );
  }

  static async expired(filters: BatchReportFilters) {
    const reportFilters: BatchReportFilters = { ...filters, onlyExpired: 'true' };
    const batches = await prisma.productBatch.findMany({
      where: buildBatchReportWhere(reportFilters),
      orderBy: { expirationDate: 'asc' },
      take: 2000,
      include: batchReportInclude,
    });
    const totalLoss = batches.reduce((s, b) => s + b.quantity * Number(b.unitCost || 0), 0);

    return preview(
      'Produtos Vencidos',
      `${buildReportSubtitle(reportFilters)} · Perda estimada: R$ ${totalLoss.toFixed(2)}`,
      [
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Local', key: 'location' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Valor', key: 'value' },
      ],
      mapBatchRows(batches)
    );
  }

  static async batches(filters: BatchReportFilters) {
    const batches = await prisma.productBatch.findMany({
      where: buildBatchReportWhere(filters),
      orderBy: [{ stockLocation: { name: 'asc' } }, { product: { name: 'asc' } }, { expirationDate: 'asc' }],
      take: 2000,
      include: batchReportInclude,
    });

    return preview(
      'Controle de Lotes',
      buildReportSubtitle(filters),
      [
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Local', key: 'location' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Status', key: 'status' },
        { header: 'Qtd', key: 'qty' },
      ],
      mapBatchRows(batches)
    );
  }

  static async byLocation(filters: BatchReportFilters) {
    const batches = await prisma.productBatch.findMany({
      where: buildBatchReportWhere(filters),
      orderBy: [{ stockLocation: { name: 'asc' } }, { expirationDate: 'asc' }],
      take: 2000,
      include: batchReportInclude,
    });

    return preview(
      'Vencimentos por Localização',
      buildReportSubtitle(filters),
      [
        { header: 'Local', key: 'location' },
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Status', key: 'status' },
        { header: 'Qtd', key: 'qty' },
      ],
      mapBatchRows(batches)
    );
  }

  static async discarded(filters: BatchReportFilters) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        type: 'SAIDA_VENCIMENTO',
        ...(filters.startDate && { movementDate: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { movementDate: { lte: new Date(filters.endDate) } }),
        ...(filters.productId && { productId: filters.productId }),
        ...(filters.stockLocationId && { originLocationId: filters.stockLocationId }),
        ...(filters.categoryId && { product: { categoryId: filters.categoryId } }),
      },
      orderBy: { movementDate: 'desc' },
      take: 2000,
      include: { product: true, batch: true, originLocation: true, user: { select: { name: true } } },
    });

    return preview(
      'Produtos Descartados por Vencimento',
      buildReportSubtitle(filters),
      [
        { header: 'Data', key: 'date' },
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Local', key: 'location' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Usuário', key: 'user' },
      ],
      movements.map((m) => ({
        date: m.movementDate.toLocaleDateString('pt-BR'),
        product: m.product.name,
        lot: m.batch?.batchNumber || '-',
        location: m.originLocation?.name || '-',
        qty: m.quantity,
        user: m.user.name,
      }))
    );
  }

  static async lossHistory(filters: BatchReportFilters) {
    const batchWhere = buildBatchReportWhere({ ...filters, onlyExpired: 'true' });
    const expiredBatches = await prisma.productBatch.findMany({
      where: batchWhere,
      include: batchReportInclude,
      take: 1000,
    });
    const movements = await prisma.stockMovement.findMany({
      where: {
        type: 'SAIDA_VENCIMENTO',
        ...(filters.startDate && { movementDate: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { movementDate: { lte: new Date(filters.endDate) } }),
      },
      include: { product: true, batch: true },
      orderBy: { movementDate: 'desc' },
      take: 1000,
    });

    const batchLoss = expiredBatches.reduce((s, b) => s + b.quantity * Number(b.unitCost || 0), 0);
    const movementLoss = movements.reduce((s, m) => s + (m.totalValue ? Number(m.totalValue) : 0), 0);

    const rows = [
      ...expiredBatches.map((b) => ({
        type: 'Saldo vencido',
        date: b.expirationDate.toLocaleDateString('pt-BR'),
        product: b.product.name,
        lot: b.batchNumber,
        qty: b.quantity,
        value: b.unitCost ? `R$ ${(Number(b.unitCost) * b.quantity).toFixed(2)}` : '-',
      })),
      ...movements.map((m) => ({
        type: 'Baixa',
        date: m.movementDate.toLocaleDateString('pt-BR'),
        product: m.product.name,
        lot: m.batch?.batchNumber || '-',
        qty: m.quantity,
        value: m.totalValue ? `R$ ${Number(m.totalValue).toFixed(2)}` : '-',
      })),
    ];

    return preview(
      'Histórico de Perdas por Vencimento',
      `${buildReportSubtitle(filters)} · Estoque vencido: R$ ${batchLoss.toFixed(2)} · Baixas: R$ ${movementLoss.toFixed(2)}`,
      [
        { header: 'Tipo', key: 'type' },
        { header: 'Data', key: 'date' },
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Valor', key: 'value' },
      ],
      rows
    );
  }

  static async expirationAudit(filters: BatchReportFilters) {
    const logs = await prisma.auditLog.findMany({
      where: {
        module: { in: ['batches', 'expiration'] },
        ...(filters.startDate && { createdAt: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { createdAt: { lte: new Date(filters.endDate) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: { user: { select: { name: true } } },
    });

    return preview(
      'Auditoria de Vencimentos',
      buildReportSubtitle(filters),
      [
        { header: 'Data', key: 'date' },
        { header: 'Usuário', key: 'user' },
        { header: 'Módulo', key: 'module' },
        { header: 'Ação', key: 'action' },
        { header: 'Entidade', key: 'entity' },
      ],
      logs.map((l) => ({
        date: l.createdAt.toLocaleString('pt-BR'),
        user: l.user?.name || 'Sistema',
        module: l.module,
        action: l.action,
        entity: l.entityId || '-',
      }))
    );
  }

  static async belowMin() {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { stockItems: true },
    });
    const below = products.filter(
      (p) => p.stockItems.reduce((s, i) => s + i.quantity, 0) < p.minQuantity
    );

    return preview(
      'Produtos Abaixo do Estoque Mínimo',
      'Produtos com saldo inferior ao mínimo configurado',
      [
        { header: 'Código', key: 'code' },
        { header: 'Produto', key: 'product' },
        { header: 'Mínimo', key: 'min' },
        { header: 'Atual', key: 'current' },
        { header: 'Déficit', key: 'deficit' },
      ],
      below.map((p) => {
        const current = p.stockItems.reduce((s, i) => s + i.quantity, 0);
        return {
          code: p.internalCode,
          product: p.name,
          min: p.minQuantity,
          current,
          deficit: p.minQuantity - current,
        };
      })
    );
  }

  static async audit(filters: Record<string, string | undefined>) {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(filters.startDate && { createdAt: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { createdAt: { lte: new Date(filters.endDate) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { name: true } } },
    });

    return preview(
      'Relatório de Auditoria',
      `Período: ${filters.startDate || 'Início'} a ${filters.endDate || 'Atual'}`,
      [
        { header: 'Data', key: 'date' },
        { header: 'Usuário', key: 'user' },
        { header: 'Módulo', key: 'module' },
        { header: 'Ação', key: 'action' },
      ],
      logs.map((l) => ({
        date: l.createdAt.toLocaleString('pt-BR'),
        user: l.user?.name || 'Sistema',
        module: l.module,
        action: l.action,
      }))
    );
  }

  static async consumption() {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const exits = await prisma.stockMovement.groupBy({
      by: ['productId'],
      where: {
        type: { in: ['SAIDA_CONSUMO', 'SAIDA_CIRURGIA', 'SAIDA_CONSULTA'] },
        movementDate: { gte: start },
      },
      _sum: { quantity: true },
    });

    const products = await prisma.product.findMany({
      where: { id: { in: exits.map((e) => e.productId) } },
    });

    return preview(
      `Consumo Mensal - ${start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
      'Saídas de consumo, cirurgia e consulta no mês atual',
      [
        { header: 'Código', key: 'code' },
        { header: 'Produto', key: 'product' },
        { header: 'Consumo', key: 'qty' },
      ],
      exits.map((e) => {
        const p = products.find((pr) => pr.id === e.productId);
        return {
          code: p?.internalCode || '-',
          product: p?.name || '-',
          qty: e._sum.quantity || 0,
        };
      })
    );
  }
}
