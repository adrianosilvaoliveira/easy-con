import { Response } from 'express';
import { prisma } from '../../database/prisma';
import { PdfProvider } from '../../providers/PdfProvider';
import { MovementType } from '@prisma/client';
import {
  batchReportInclude,
  buildBatchReportWhere,
  buildReportSubtitle,
  type BatchReportFilters,
} from './batchReportFilters';
import { statusLabel } from '../../shared/utils/expiration';

const ENTRY_TYPES: MovementType[] = [
  'ENTRADA_COMPRA',
  'ENTRADA_MANUAL',
  'AJUSTE_ENTRADA',
  'DEVOLUCAO',
];

export class ReportService {
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

  static async stockPdf(res: Response, userName?: string) {
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

    await PdfProvider.generate(res, {
      title: 'Relatório de Estoque Completo',
      subtitle: `${stockItems.length} item(ns) em estoque · Quantidade total: ${totalQuantity}`,
      filename: 'estoque-completo',
      userName,
      columns: [
        { header: 'Código', key: 'code' },
        { header: 'Produto', key: 'product' },
        { header: 'Categoria', key: 'category' },
        { header: 'Local', key: 'location' },
        { header: 'Lote', key: 'lot' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Un.', key: 'unit' },
        { header: 'Qtd', key: 'qty' },
      ],
      rows: this.mapStockRows(stockItems),
    });
  }

  static async movementsPdf(
    res: Response,
    filters: Record<string, string | undefined>,
    userName?: string
  ) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(filters.startDate && {
          movementDate: { gte: new Date(filters.startDate) },
        }),
        ...(filters.endDate && {
          movementDate: { lte: new Date(filters.endDate) },
        }),
        ...(filters.type && { type: filters.type as MovementType }),
      },
      orderBy: { movementDate: 'desc' },
      take: 500,
      include: {
        product: { select: { name: true, internalCode: true } },
        user: { select: { name: true } },
        originLocation: { select: { name: true } },
        destinationLocation: { select: { name: true } },
      },
    });

    await PdfProvider.generate(res, {
      title: 'Relatório de Movimentações',
      subtitle: `Período: ${filters.startDate || 'Início'} a ${filters.endDate || 'Atual'}`,
      filename: 'movimentacoes',
      userName,
      columns: [
        { header: 'Data', key: 'date' },
        { header: 'Tipo', key: 'type' },
        { header: 'Produto', key: 'product' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Usuário', key: 'user' },
      ],
      rows: movements.map((m) => ({
        date: m.movementDate.toLocaleDateString('pt-BR'),
        type: m.type.replace(/_/g, ' '),
        product: m.product.name,
        qty: m.quantity,
        user: m.user.name,
      })),
    });
  }

  static async entriesPdf(res: Response, filters: Record<string, string | undefined>, userName?: string) {
    const entries = await prisma.stockMovement.findMany({
      where: {
        type: { in: ENTRY_TYPES },
        ...(filters.startDate && { movementDate: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { movementDate: { lte: new Date(filters.endDate) } }),
      },
      orderBy: { movementDate: 'desc' },
      take: 500,
      include: {
        product: true,
        supplier: true,
        destinationLocation: true,
        user: { select: { name: true } },
      },
    });

    await PdfProvider.generate(res, {
      title: 'Relatório de Entradas',
      filename: 'entradas',
      userName,
      columns: [
        { header: 'Data', key: 'date' },
        { header: 'Produto', key: 'product' },
        { header: 'NF', key: 'invoice' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Valor', key: 'value' },
      ],
      rows: entries.map((m) => ({
        date: m.movementDate.toLocaleDateString('pt-BR'),
        product: m.product.name,
        invoice: m.invoiceNumber || '-',
        qty: m.quantity,
        value: m.totalValue ? `R$ ${Number(m.totalValue).toFixed(2)}` : '-',
      })),
    });
  }

  static async exitsPdf(res: Response, filters: Record<string, string | undefined>, userName?: string) {
    const exits = await prisma.stockMovement.findMany({
      where: {
        type: { notIn: [...ENTRY_TYPES, 'TRANSFERENCIA'] },
        ...(filters.startDate && { movementDate: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { movementDate: { lte: new Date(filters.endDate) } }),
      },
      orderBy: { movementDate: 'desc' },
      take: 500,
      include: { product: true, originLocation: true, user: { select: { name: true } } },
    });

    await PdfProvider.generate(res, {
      title: 'Relatório de Saídas',
      filename: 'saidas',
      userName,
      columns: [
        { header: 'Data', key: 'date' },
        { header: 'Tipo', key: 'type' },
        { header: 'Produto', key: 'product' },
        { header: 'Origem', key: 'origin' },
        { header: 'Qtd', key: 'qty' },
      ],
      rows: exits.map((m) => ({
        date: m.movementDate.toLocaleDateString('pt-BR'),
        type: m.type.replace(/_/g, ' '),
        product: m.product.name,
        origin: m.originLocation?.name || '-',
        qty: m.quantity,
      })),
    });
  }

  private static mapBatchRows(
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

  static async expiringPdf(res: Response, filters: BatchReportFilters, userName?: string) {
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

    await PdfProvider.generate(res, {
      title: `Produtos Vencendo (${days} dias)`,
      subtitle: buildReportSubtitle(reportFilters),
      filename: 'produtos-vencendo',
      userName,
      columns: [
        { header: 'Código', key: 'code' },
        { header: 'Produto', key: 'product' },
        { header: 'Categoria', key: 'category' },
        { header: 'Lote', key: 'lot' },
        { header: 'Local', key: 'location' },
        { header: 'Fornecedor', key: 'supplier' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Status', key: 'status' },
        { header: 'Qtd', key: 'qty' },
      ],
      rows: this.mapBatchRows(batches),
    });
  }

  static async expiredPdf(res: Response, filters: BatchReportFilters, userName?: string) {
    const reportFilters: BatchReportFilters = {
      ...filters,
      onlyExpired: 'true',
    };

    const batches = await prisma.productBatch.findMany({
      where: buildBatchReportWhere(reportFilters),
      orderBy: { expirationDate: 'asc' },
      take: 2000,
      include: batchReportInclude,
    });

    const totalLoss = batches.reduce(
      (s, b) => s + b.quantity * Number(b.unitCost || 0),
      0
    );

    await PdfProvider.generate(res, {
      title: 'Produtos Vencidos',
      subtitle: `${buildReportSubtitle(reportFilters)} · Perda estimada: R$ ${totalLoss.toFixed(2)}`,
      filename: 'produtos-vencidos',
      userName,
      columns: [
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Local', key: 'location' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Valor', key: 'value' },
      ],
      rows: this.mapBatchRows(batches),
    });
  }

  static async batchesPdf(res: Response, filters: BatchReportFilters, userName?: string) {
    const batches = await prisma.productBatch.findMany({
      where: buildBatchReportWhere(filters),
      orderBy: [{ stockLocation: { name: 'asc' } }, { product: { name: 'asc' } }, { expirationDate: 'asc' }],
      take: 2000,
      include: batchReportInclude,
    });

    await PdfProvider.generate(res, {
      title: 'Controle de Lotes',
      subtitle: buildReportSubtitle(filters),
      filename: 'produtos-por-lote',
      userName,
      columns: [
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Local', key: 'location' },
        { header: 'Fornecedor', key: 'supplier' },
        { header: 'Fabricação', key: 'mfg' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Status', key: 'status' },
        { header: 'Qtd', key: 'qty' },
      ],
      rows: this.mapBatchRows(batches),
    });
  }

  static async byLocationPdf(res: Response, filters: BatchReportFilters, userName?: string) {
    const batches = await prisma.productBatch.findMany({
      where: buildBatchReportWhere(filters),
      orderBy: [{ stockLocation: { name: 'asc' } }, { expirationDate: 'asc' }],
      take: 2000,
      include: batchReportInclude,
    });

    await PdfProvider.generate(res, {
      title: 'Vencimentos por Localização',
      subtitle: buildReportSubtitle(filters),
      filename: 'vencimentos-por-local',
      userName,
      columns: [
        { header: 'Local', key: 'location' },
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Validade', key: 'expiry' },
        { header: 'Status', key: 'status' },
        { header: 'Qtd', key: 'qty' },
      ],
      rows: this.mapBatchRows(batches),
    });
  }

  static async discardedPdf(res: Response, filters: BatchReportFilters, userName?: string) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        type: 'SAIDA_VENCIMENTO',
        ...(filters.startDate && { movementDate: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { movementDate: { lte: new Date(filters.endDate) } }),
        ...(filters.productId && { productId: filters.productId }),
        ...(filters.stockLocationId && { originLocationId: filters.stockLocationId }),
        ...(filters.categoryId && { product: { categoryId: filters.categoryId } }),
        ...(filters.supplierId && { batch: { supplierId: filters.supplierId } }),
        ...(filters.batchNumber && {
          batch: { batchNumber: { contains: filters.batchNumber, mode: 'insensitive' } },
        }),
      },
      orderBy: { movementDate: 'desc' },
      take: 2000,
      include: {
        product: { include: { category: true } },
        batch: true,
        originLocation: true,
        user: { select: { name: true } },
      },
    });

    await PdfProvider.generate(res, {
      title: 'Produtos Descartados por Vencimento',
      subtitle: buildReportSubtitle(filters),
      filename: 'produtos-descartados',
      userName,
      columns: [
        { header: 'Data', key: 'date' },
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Local', key: 'location' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Usuário', key: 'user' },
      ],
      rows: movements.map((m) => ({
        date: m.movementDate.toLocaleDateString('pt-BR'),
        product: m.product.name,
        lot: m.batch?.batchNumber || '-',
        location: m.originLocation?.name || '-',
        qty: m.quantity,
        user: m.user.name,
      })),
    });
  }

  static async lossHistoryPdf(res: Response, filters: BatchReportFilters, userName?: string) {
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
        ...(filters.productId && { productId: filters.productId }),
        ...(filters.stockLocationId && { originLocationId: filters.stockLocationId }),
      },
      include: { product: true, batch: true },
      orderBy: { movementDate: 'desc' },
      take: 1000,
    });

    const batchLoss = expiredBatches.reduce(
      (s, b) => s + b.quantity * Number(b.unitCost || 0),
      0
    );
    const movementLoss = movements.reduce(
      (s, m) => s + (m.totalValue ? Number(m.totalValue) : 0),
      0
    );

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

    await PdfProvider.generate(res, {
      title: 'Histórico de Perdas por Vencimento',
      subtitle: `${buildReportSubtitle(filters)} · Estoque vencido: R$ ${batchLoss.toFixed(2)} · Baixas: R$ ${movementLoss.toFixed(2)}`,
      filename: 'historico-perdas',
      userName,
      columns: [
        { header: 'Tipo', key: 'type' },
        { header: 'Data', key: 'date' },
        { header: 'Produto', key: 'product' },
        { header: 'Lote', key: 'lot' },
        { header: 'Qtd', key: 'qty' },
        { header: 'Valor', key: 'value' },
      ],
      rows,
    });
  }

  static async expirationAuditPdf(res: Response, filters: BatchReportFilters, userName?: string) {
    const logs = await prisma.auditLog.findMany({
      where: {
        module: { in: ['batches', 'expiration'] },
        ...(filters.startDate && { createdAt: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { createdAt: { lte: new Date(filters.endDate) } }),
        ...(filters.productId && { entityId: filters.productId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: { user: { select: { name: true } } },
    });

    await PdfProvider.generate(res, {
      title: 'Auditoria de Vencimentos',
      subtitle: buildReportSubtitle(filters),
      filename: 'auditoria-vencimentos',
      userName,
      columns: [
        { header: 'Data', key: 'date' },
        { header: 'Usuário', key: 'user' },
        { header: 'Módulo', key: 'module' },
        { header: 'Ação', key: 'action' },
        { header: 'Entidade', key: 'entity' },
      ],
      rows: logs.map((l) => ({
        date: l.createdAt.toLocaleString('pt-BR'),
        user: l.user?.name || 'Sistema',
        module: l.module,
        action: l.action,
        entity: l.entityId || '-',
      })),
    });
  }

  static async belowMinPdf(res: Response, userName?: string) {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { stockItems: true, category: true },
    });

    const below = products.filter(
      (p) => p.stockItems.reduce((s, i) => s + i.quantity, 0) < p.minQuantity
    );

    await PdfProvider.generate(res, {
      title: 'Produtos Abaixo do Estoque Mínimo',
      filename: 'estoque-minimo',
      userName,
      columns: [
        { header: 'Código', key: 'code' },
        { header: 'Produto', key: 'product' },
        { header: 'Mínimo', key: 'min' },
        { header: 'Atual', key: 'current' },
        { header: 'Déficit', key: 'deficit' },
      ],
      rows: below.map((p) => {
        const current = p.stockItems.reduce((s, i) => s + i.quantity, 0);
        return {
          code: p.internalCode,
          product: p.name,
          min: p.minQuantity,
          current,
          deficit: p.minQuantity - current,
        };
      }),
    });
  }

  static async auditPdf(
    res: Response,
    filters: Record<string, string | undefined>,
    userName?: string
  ) {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(filters.startDate && { createdAt: { gte: new Date(filters.startDate) } }),
        ...(filters.endDate && { createdAt: { lte: new Date(filters.endDate) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { name: true } } },
    });

    await PdfProvider.generate(res, {
      title: 'Relatório de Auditoria',
      filename: 'auditoria',
      userName,
      columns: [
        { header: 'Data', key: 'date' },
        { header: 'Usuário', key: 'user' },
        { header: 'Módulo', key: 'module' },
        { header: 'Ação', key: 'action' },
      ],
      rows: logs.map((l) => ({
        date: l.createdAt.toLocaleString('pt-BR'),
        user: l.user?.name || 'Sistema',
        module: l.module,
        action: l.action,
      })),
    });
  }

  static async monthlyConsumptionPdf(res: Response, userName?: string) {
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

    await PdfProvider.generate(res, {
      title: `Consumo Mensal - ${start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
      filename: 'consumo-mensal',
      userName,
      columns: [
        { header: 'Código', key: 'code' },
        { header: 'Produto', key: 'product' },
        { header: 'Consumo', key: 'qty' },
      ],
      rows: exits.map((e) => {
        const p = products.find((pr) => pr.id === e.productId);
        return {
          code: p?.internalCode || '-',
          product: p?.name || '-',
          qty: e._sum.quantity || 0,
        };
      }),
    });
  }
}
