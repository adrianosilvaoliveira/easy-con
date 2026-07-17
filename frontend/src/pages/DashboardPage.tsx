import { Suspense, lazy, useState } from 'react';
import { cn } from '@/utils/cn';
import {
  Package,
  MapPin,
  ArrowLeftRight,
  AlertTriangle,
  Clock,
  TrendingUp,
  CalendarClock,
  Skull,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { ExpirationBadge, ExpirationStatusType } from '@/components/expiration/ExpirationBadge';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import { DataTable } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { StockMovement } from '@/types';
import { ChartPeriodFilter, type ChartPeriod } from '@/components/dashboard/ChartPeriodFilter';
import { formatDate, formatDateTime, movementTypeLabel, formatProductName } from '@/utils/format';
import { useChartTheme } from '@/constants/chartTheme';
import {
  useDashboardMetrics,
  useDashboardChart,
  useBatchesDashboard,
} from '@/hooks/queries/useDashboard';
import {
  DashboardKpiModal,
  type DashboardKpiType,
} from '@/components/dashboard/DashboardKpiModal';

const ExpirationAlertsModal = lazy(() =>
  import('@/components/alerts/ExpirationAlertsModal').then((m) => ({
    default: m.ExpirationAlertsModal,
  }))
);

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  onClick,
  alertActive,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  onClick?: () => void;
  /** Pulso discreto quando há alertas ativos (sem mudar layout do card) */
  alertActive?: boolean;
}) {
  const className = cn(
    'card flex w-full items-start justify-between gap-3 text-left transition',
    onClick && 'cursor-pointer hover:border-primary-300 hover:shadow-card dark:hover:border-primary-700',
    alertActive && 'ring-2 ring-red-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 animate-pulse'
  );

  const content = (
    <>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-600 sm:text-sm dark:text-slate-300">{title}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">{value}</p>
        {subtitle && <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className={`shrink-0 rounded-xl p-2.5 sm:p-3 ${color}`}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} aria-label={`${title}: abrir detalhes`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

const chartTooltipStyle = (chart: ReturnType<typeof useChartTheme>) => ({
  backgroundColor: chart.tooltipBg,
  borderColor: chart.tooltipBorder,
  color: chart.tooltipColor,
  fontSize: 12,
});

export function DashboardPage() {
  const chart = useChartTheme();
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [kpiModal, setKpiModal] = useState<DashboardKpiType | null>(null);

  const openKpi = (type: DashboardKpiType) => setKpiModal(type);
  const closeKpi = () => setKpiModal(null);

  const { data, isPending, isError, error, refetch } = useDashboardMetrics();
  const { data: chartResponse, isLoading: chartLoading } = useDashboardChart(chartPeriod);
  const { data: expMetrics } = useBatchesDashboard();

  const pendingAlertsCount = expMetrics?.counts?.alertsCount ?? 0;

  if (isPending) {
    return (
      <div className="page-content">
        <PageHeader title="Dashboard" />
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const ax = error as {
      code?: string;
      response?: { status?: number; data?: { message?: string } };
    };
    const message =
      ax.response?.data?.message ??
      (ax.code === 'ECONNABORTED'
        ? 'Servidor demorou para responder. Tente novamente.'
        : 'Não foi possível carregar os indicadores do dashboard.');

    return (
      <div className="page-content">
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={WifiOff}
          title="Falha ao carregar o dashboard"
          description={message}
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  const metrics = data;

  return (
    <div className="page-content">
      <PageHeader title="Dashboard" />

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5 xl:gap-5">
        <KpiCard
          title="Produtos Ativos"
          value={metrics.kpis.totalProducts}
          icon={Package}
          color="bg-blue-50 text-blue-600"
          onClick={() => openKpi('active-products')}
        />
        <KpiCard
          title="Locais de Estoque"
          value={metrics.kpis.totalLocations}
          icon={MapPin}
          color="bg-emerald-50 text-emerald-600"
          onClick={() => openKpi('locations')}
        />
        <KpiCard
          title="Movimentações Hoje"
          value={metrics.kpis.todayMovements}
          icon={ArrowLeftRight}
          color="bg-violet-50 text-violet-600"
          onClick={() => openKpi('today-movements')}
        />
        <KpiCard
          title="Abaixo do Mínimo"
          value={metrics.kpis.belowMinCount}
          icon={AlertTriangle}
          color="bg-red-50 text-red-600"
          subtitle="Requer reposição"
          onClick={() => openKpi('below-min')}
        />
        <KpiCard
          title="Vencendo (30 dias)"
          value={metrics.kpis.expiringCount}
          icon={TrendingUp}
          color="bg-orange-50 text-orange-600"
          subtitle="Atenção à validade"
          onClick={() => openKpi('expiring-30')}
        />
      </div>

      {expMetrics && (
        <>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
            <KpiCard
              title="Lotes Vencidos"
              value={expMetrics.counts.expired}
              icon={Skull}
              color="bg-red-50 text-red-600"
              onClick={() => openKpi('expired-batches')}
            />
            <KpiCard
              title="Críticos (30d)"
              value={expMetrics.counts.critical}
              icon={AlertTriangle}
              color="bg-orange-50 text-orange-600"
              onClick={() => openKpi('critical-batches')}
            />
            <KpiCard
              title="Atenção (90d)"
              value={expMetrics.counts.warning}
              icon={CalendarClock}
              color="bg-amber-50 text-amber-600"
              onClick={() => openKpi('warning-batches')}
            />
            <KpiCard
              title="Alertas Pendentes"
              value={pendingAlertsCount}
              icon={Clock}
              color="bg-red-50 text-red-600"
              onClick={() => setAlertsModalOpen(true)}
              alertActive={pendingAlertsCount > 0}
            />
            <KpiCard
              title="Perda Financeira"
              value={`R$ ${Number(expMetrics.financialLoss).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
              color="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              subtitle="Lotes vencidos"
            />
          </div>

          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card min-w-0">
              <h2 className="mb-3 text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
                Vencimentos por Mês
              </h2>
              <ChartContainer height={240} mobileHeight={180}>
                {({ width, height }) => (
                  <ResponsiveContainer width={width} height={height}>
                    <BarChart data={expMetrics.expiringByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.gridStroke} />
                      <XAxis dataKey="month" tick={chart.axisTick} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={chart.axisTick} width={36} />
                      <Tooltip contentStyle={chartTooltipStyle(chart)} />
                      <Bar dataKey="count" name="Qtd" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartContainer>
            </div>

            <div className="card min-w-0">
              <h2 className="mb-3 text-base font-semibold text-red-700 sm:text-lg">Estoque Crítico</h2>
              <div className="table-container">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 bg-red-100 dark:border-slate-600 dark:bg-red-950/40">
                      <th className="px-3 py-2 text-left font-semibold text-slate-800 dark:text-slate-200">Produto</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-800 dark:text-slate-200">Lote</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-200">Validade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expMetrics.criticalBatches?.slice(0, 6).map((b: {
                      id: string;
                      batchNumber: string;
                      expirationDate: string;
                      status: ExpirationStatusType;
                      product: { name: string };
                    }) => (
                      <tr key={b.id} className="border-b border-slate-200 dark:border-slate-700">
                        <td className="truncate px-3 py-2 max-w-[120px]">{formatProductName(b.product.name)}</td>
                        <td className="px-3 py-2">{b.batchNumber}</td>
                        <td className="px-3 py-2 text-right">
                          <ExpirationBadge status={b.status} />
                        </td>
                      </tr>
                    ))}
                    {!expMetrics.criticalBatches?.length && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center font-medium text-slate-600 dark:text-slate-400">
                          Nenhum lote crítico
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card w-full min-w-0 max-w-full overflow-hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
            Entradas x Saídas
          </h2>
          <ChartPeriodFilter value={chartPeriod} onChange={setChartPeriod} />
        </div>
        <div className={chartLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <ChartContainer height={320} mobileHeight={220}>
          {({ width, height }) => (
            <AreaChart
              width={width}
              height={height}
              data={chartResponse?.chartData ?? []}
              margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridStroke} />
              <XAxis
                dataKey="date"
                tick={chart.axisTick}
                interval="preserveStartEnd"
              />
              <YAxis tick={chart.axisTick} width={36} />
              <Tooltip contentStyle={chartTooltipStyle(chart)} />
              <Legend wrapperStyle={{ fontSize: 11, color: chart.axisTick.fill }} />
              <Area type="monotone" dataKey="entries" name="Entradas" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.4} />
              <Area type="monotone" dataKey="exits" name="Saídas" stroke="#dc2626" fill="#fca5a5" fillOpacity={0.4} />
            </AreaChart>
          )}
        </ChartContainer>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 xl:gap-8">
        <div className="min-w-0">
          <h2 className="mb-2 text-base font-semibold text-red-700 sm:mb-3 sm:text-lg">
            Produtos Abaixo do Mínimo
          </h2>
          <div className="table-container">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-red-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-800 sm:px-4 sm:text-sm">
                    Produto
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-800 sm:px-4 sm:text-sm">
                    Atual
                  </th>
                  <th className="hidden px-3 py-2 text-right text-xs font-semibold text-slate-800 sm:table-cell sm:px-4 sm:text-sm">
                    Mínimo
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.belowMin.slice(0, 5).map((p) => (
                  <tr key={p.id} className="border-b border-slate-200">
                    <td className="max-w-[140px] truncate px-3 py-2 sm:max-w-none sm:px-4">{p.name}</td>
                    <td className="px-3 py-2 text-right font-medium text-red-600 sm:px-4">{p.current}</td>
                    <td className="hidden px-3 py-2 text-right sm:table-cell sm:px-4">{p.minQuantity}</td>
                  </tr>
                ))}
                {!metrics.belowMin.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center font-medium text-slate-600">
                      Nenhum alerta
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="mb-2 text-base font-semibold text-amber-700 sm:mb-3 sm:text-lg">
            Produtos Vencendo
          </h2>
          <div className="table-container">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-amber-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-800 sm:px-4 sm:text-sm">
                    Produto
                  </th>
                  <th className="hidden px-3 py-2 text-left text-xs font-semibold text-slate-800 sm:table-cell sm:px-4 sm:text-sm">
                    Lote
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-800 sm:px-4 sm:text-sm">
                    Validade
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.expiring.slice(0, 5).map((b) => (
                  <tr key={b.id} className="border-b border-slate-200">
                    <td className="max-w-[140px] truncate px-3 py-2 sm:max-w-none sm:px-4">{formatProductName(b.product.name)}</td>
                    <td className="hidden px-3 py-2 sm:table-cell sm:px-4">{b.batchNumber}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right sm:px-4">{formatDate(b.expirationDate)}</td>
                  </tr>
                ))}
                {!metrics.expiring.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center font-medium text-slate-600">
                      Nenhum vencimento próximo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="mb-2 text-base font-semibold text-slate-900 sm:mb-3 sm:text-lg dark:text-slate-100">
          Movimentações Recentes
        </h2>
        <DataTable<StockMovement>
          columns={[
            { key: 'date', header: 'Data', render: (m) => formatDateTime(m.movementDate) },
            { key: 'type', header: 'Tipo', render: (m) => <Badge variant="info">{movementTypeLabel(m.type)}</Badge>, hideBelow: 'md' },
            { key: 'product', header: 'Produto', render: (m) => <span className="max-w-[120px] truncate sm:max-w-none">{formatProductName(m.product.name)}</span> },
            { key: 'qty', header: 'Qtd', render: (m) => m.quantity },
            { key: 'user', header: 'Usuário', render: (m) => m.user.name, hideBelow: 'lg' },
          ]}
          data={metrics.recentMovements}
          emptyIcon={ArrowLeftRight}
          emptyTitle="Sem movimentações recentes"
        />
      </div>
      <DashboardKpiModal
        type={kpiModal}
        open={!!kpiModal}
        onClose={closeKpi}
        belowMinData={metrics.belowMin}
      />
      {alertsModalOpen && (
        <Suspense fallback={null}>
          <ExpirationAlertsModal open onClose={() => setAlertsModalOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
