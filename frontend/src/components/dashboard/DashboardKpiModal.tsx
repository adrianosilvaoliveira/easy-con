import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ExpirationBadge, type ExpirationStatusType } from '@/components/expiration/ExpirationBadge';
import type { DashboardMetrics, PaginatedResponse, Product, StockLocation, StockMovement } from '@/types';
import { formatDate, formatDateTime, formatProductName, movementTypeLabel } from '@/utils/format';

export type DashboardKpiType =
  | 'active-products'
  | 'locations'
  | 'today-movements'
  | 'below-min'
  | 'expiring-30'
  | 'expired-batches'
  | 'critical-batches'
  | 'warning-batches';

type BatchRow = {
  id: string;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  status: ExpirationStatusType;
  product: { name: string; internalCode: string; category?: { name: string } };
  stockLocation: { name: string };
};

const KPI_TITLES: Record<DashboardKpiType, string> = {
  'active-products': 'Produtos Ativos',
  locations: 'Locais de Estoque',
  'today-movements': 'Movimentações Hoje',
  'below-min': 'Produtos Abaixo do Mínimo',
  'expiring-30': 'Produtos Vencendo (30 dias)',
  'expired-batches': 'Lotes Vencidos',
  'critical-batches': 'Lotes Críticos (30 dias)',
  'warning-batches': 'Lotes em Atenção (90 dias)',
};

function todayRangeIso() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

type Props = {
  type: DashboardKpiType | null;
  open: boolean;
  onClose: () => void;
  belowMinData?: DashboardMetrics['belowMin'];
};

export function DashboardKpiModal({ type, open, onClose, belowMinData }: Props) {
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['dashboard-kpi', 'products'],
    queryFn: () =>
      api
        .get<PaginatedResponse<Product>>('/products', { params: { limit: 500 } })
        .then((r) => r.data.data),
    enabled: open && type === 'active-products',
  });

  const { data: locations, isLoading: loadingLocations } = useQuery({
    queryKey: ['dashboard-kpi', 'locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data as StockLocation[]),
    enabled: open && type === 'locations',
  });

  const { data: todayMovements, isLoading: loadingMovements } = useQuery({
    queryKey: ['dashboard-kpi', 'today-movements'],
    queryFn: () => {
      const range = todayRangeIso();
      return api
        .get<PaginatedResponse<StockMovement>>('/movements', {
          params: { ...range, limit: 200 },
        })
        .then((r) => r.data.data);
    },
    enabled: open && type === 'today-movements',
  });

  const { data: expiringBatches, isLoading: loadingExpiring } = useQuery({
    queryKey: ['dashboard-kpi', 'expiring-30'],
    queryFn: () =>
      api
        .get<PaginatedResponse<BatchRow>>('/batches/expiring', { params: { days: 30, limit: 200 } })
        .then((r) => r.data.data),
    enabled: open && type === 'expiring-30',
  });

  const { data: expiredBatches, isLoading: loadingExpired } = useQuery({
    queryKey: ['dashboard-kpi', 'expired-batches'],
    queryFn: () =>
      api
        .get<PaginatedResponse<BatchRow>>('/batches/expired', { params: { limit: 200 } })
        .then((r) => r.data.data),
    enabled: open && type === 'expired-batches',
  });

  const { data: criticalBatches, isLoading: loadingCritical } = useQuery({
    queryKey: ['dashboard-kpi', 'critical-batches'],
    queryFn: () =>
      api
        .get<PaginatedResponse<BatchRow>>('/batches', { params: { status: 'CRITICAL', limit: 200 } })
        .then((r) => r.data.data),
    enabled: open && type === 'critical-batches',
  });

  const { data: warningBatches, isLoading: loadingWarning } = useQuery({
    queryKey: ['dashboard-kpi', 'warning-batches'],
    queryFn: () =>
      api
        .get<PaginatedResponse<BatchRow>>('/batches', { params: { status: 'WARNING', limit: 200 } })
        .then((r) => r.data.data),
    enabled: open && type === 'warning-batches',
  });

  if (!type) return null;

  const title = KPI_TITLES[type];
  const isLoading =
    (type === 'active-products' && loadingProducts) ||
    (type === 'locations' && loadingLocations) ||
    (type === 'today-movements' && loadingMovements) ||
    (type === 'expiring-30' && loadingExpiring) ||
    (type === 'expired-batches' && loadingExpired) ||
    (type === 'critical-batches' && loadingCritical) ||
    (type === 'warning-batches' && loadingWarning);

  const batchColumns = [
    { key: 'product', header: 'Produto', render: (b: BatchRow) => formatProductName(b.product.name) },
    { key: 'code', header: 'Código', render: (b: BatchRow) => b.product.internalCode, hideBelow: 'md' as const },
    { key: 'lot', header: 'Lote', render: (b: BatchRow) => b.batchNumber },
    { key: 'location', header: 'Local', render: (b: BatchRow) => b.stockLocation.name, hideBelow: 'sm' as const },
    { key: 'expiry', header: 'Validade', render: (b: BatchRow) => formatDate(b.expirationDate) },
    { key: 'qty', header: 'Qtd', render: (b: BatchRow) => b.quantity },
    { key: 'status', header: 'Status', render: (b: BatchRow) => <ExpirationBadge status={b.status} /> },
  ];

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Carregando...
      </div>
    );
  } else if (type === 'active-products') {
    content = (
      <DataTable<Product>
        data={products ?? []}
        columns={[
          { key: 'code', header: 'Código', render: (p) => p.internalCode },
          { key: 'name', header: 'Produto', render: (p) => formatProductName(p.name) },
          { key: 'category', header: 'Categoria', render: (p) => p.category?.name || '-', hideBelow: 'md' },
          { key: 'unit', header: 'Un.', render: (p) => p.unit, hideBelow: 'sm' },
        ]}
        emptyTitle="Nenhum produto ativo"
      />
    );
  } else if (type === 'locations') {
    content = (
      <DataTable<StockLocation>
        data={locations ?? []}
        columns={[
          { key: 'name', header: 'Local', render: (l) => l.name },
          { key: 'code', header: 'Código', render: (l) => l.code },
          { key: 'type', header: 'Tipo', render: (l) => l.type, hideBelow: 'sm' },
          {
            key: 'qty',
            header: 'Qtd total',
            render: (l) => l.totalQuantity ?? '-',
            hideBelow: 'md',
          },
        ]}
        emptyTitle="Nenhum local cadastrado"
      />
    );
  } else if (type === 'today-movements') {
    content = (
      <DataTable<StockMovement>
        data={todayMovements ?? []}
        columns={[
          { key: 'date', header: 'Data', render: (m) => formatDateTime(m.movementDate) },
          { key: 'type', header: 'Tipo', render: (m) => <Badge variant="info">{movementTypeLabel(m.type)}</Badge> },
          { key: 'product', header: 'Produto', render: (m) => formatProductName(m.product.name) },
          { key: 'qty', header: 'Qtd', render: (m) => m.quantity },
          { key: 'user', header: 'Usuário', render: (m) => m.user.name, hideBelow: 'md' },
        ]}
        emptyTitle="Nenhuma movimentação hoje"
      />
    );
  } else if (type === 'below-min') {
    const rows = belowMinData ?? [];
    content = (
      <DataTable<(typeof rows)[number]>
        data={rows}
        columns={[
          { key: 'code', header: 'Código', render: (p) => p.internalCode },
          { key: 'name', header: 'Produto', render: (p) => formatProductName(p.name) },
          { key: 'category', header: 'Categoria', render: (p) => p.category || '-', hideBelow: 'md' },
          { key: 'current', header: 'Atual', render: (p) => <span className="font-medium text-red-600">{p.current}</span> },
          { key: 'min', header: 'Mínimo', render: (p) => p.minQuantity },
        ]}
        emptyTitle="Nenhum produto abaixo do mínimo"
      />
    );
  } else if (type === 'expiring-30') {
    content = <DataTable data={expiringBatches ?? []} columns={batchColumns} emptyTitle="Nenhum lote vencendo em 30 dias" />;
  } else if (type === 'expired-batches') {
    content = <DataTable data={expiredBatches ?? []} columns={batchColumns} emptyTitle="Nenhum lote vencido" />;
  } else if (type === 'critical-batches') {
    content = <DataTable data={criticalBatches ?? []} columns={batchColumns} emptyTitle="Nenhum lote crítico" />;
  } else {
    content = <DataTable data={warningBatches ?? []} columns={batchColumns} emptyTitle="Nenhum lote em atenção" />;
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="2xl">
      {content}
    </Modal>
  );
}
