import { useState } from 'react';
import { Filter, X, Download } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ReportCard } from '@/components/reports/ReportCard';
import { ReportViewerModal } from '@/components/reports/ReportViewerModal';
import {
  ExpirationReportFilters,
  ExpirationReportFilterValues,
  filtersToQueryParams,
} from '@/components/reports/ExpirationReportFilters';

type ReportCategory = 'general' | 'expiration';

interface ReportDef {
  id: string;
  label: string;
  endpoint: string;
  category: ReportCategory;
  showDateRange?: boolean;
}

const reports: ReportDef[] = [
  { id: 'movements', label: 'Movimentações', endpoint: '/reports/movements/pdf', category: 'general' },
  { id: 'entries', label: 'Entradas', endpoint: '/reports/entries/pdf', category: 'general' },
  { id: 'exits', label: 'Saídas', endpoint: '/reports/exits/pdf', category: 'general' },
  { id: 'expiring', label: 'Produtos Vencendo', endpoint: '/reports/expiring/pdf', category: 'expiration' },
  { id: 'expired', label: 'Produtos Vencidos', endpoint: '/reports/expired/pdf', category: 'expiration' },
  { id: 'batches', label: 'Produtos por Lote', endpoint: '/reports/batches/pdf', category: 'expiration' },
  { id: 'by-location', label: 'Por Localização', endpoint: '/reports/by-location/pdf', category: 'expiration' },
  { id: 'discarded', label: 'Produtos Descartados', endpoint: '/reports/discarded/pdf', category: 'expiration', showDateRange: true },
  { id: 'loss-history', label: 'Histórico de Perdas', endpoint: '/reports/loss-history/pdf', category: 'expiration', showDateRange: true },
  { id: 'expiration-audit', label: 'Auditoria de Vencimentos', endpoint: '/reports/expiration-audit/pdf', category: 'expiration', showDateRange: true },
  { id: 'below-min', label: 'Estoque Mínimo', endpoint: '/reports/below-min/pdf', category: 'general' },
  { id: 'audit', label: 'Auditoria Geral', endpoint: '/reports/audit/pdf', category: 'general' },
  { id: 'consumption', label: 'Consumo Mensal', endpoint: '/reports/consumption/pdf', category: 'general' },
];

const defaultExpirationFilters: ExpirationReportFilterValues = {
  expiringDays: '90',
};

export function ReportsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [filterModal, setFilterModal] = useState<ReportDef | null>(null);
  const [viewerReport, setViewerReport] = useState<ReportDef | null>(null);
  const [expirationFilters, setExpirationFilters] =
    useState<ExpirationReportFilterValues>(defaultExpirationFilters);

  const buildQuery = (report: ReportDef) => {
    const params = new URLSearchParams();
    if (report.category === 'expiration') {
      Object.entries(filtersToQueryParams(expirationFilters)).forEach(([k, v]) =>
        params.append(k, v)
      );
      if (report.id === 'expiring' && !expirationFilters.onlyExpired) {
        params.set('onlyExpiring', 'true');
      }
      if (report.id === 'expired') {
        params.set('onlyExpired', 'true');
      }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const fetchPdfBlob = async (report: ReportDef) => {
    const url = `${import.meta.env.VITE_API_URL || '/api'}${report.endpoint}${buildQuery(report)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message);
    }
    return response.blob();
  };

  const downloadReport = async (report: ReportDef) => {
    try {
      const blob = await fetchPdfBlob(report);
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${report.id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('PDF baixado');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
  };

  const openPdfInNewTab = async (report: ReportDef) => {
    try {
      const blob = await fetchPdfBlob(report);
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
      toast.success('PDF aberto em nova aba');
    } catch {
      toast.error('Erro ao abrir PDF');
    }
  };

  const generalReports = reports.filter((r) => r.category === 'general');
  const expirationReports = reports.filter((r) => r.category === 'expiration');

  return (
    <div className="page-content">
      <PageHeader
        title="Relatórios"
        action={
          <Button variant="secondary" onClick={() => setFilterModal(expirationReports[0])}>
            <Filter className="h-4 w-4" /> Filtros de Vencimento
          </Button>
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Vencimentos e Lotes
        </h2>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {expirationReports.map((report) => (
            <ReportCard
              key={report.id}
              label={report.label}
              accent="amber"
              showFilter
              onOpen={() => setViewerReport(report)}
              onFilter={() => setFilterModal(report)}
              onDownloadPdf={() => downloadReport(report)}
              onOpenPdf={() => openPdfInNewTab(report)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Estoque e Operações
        </h2>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {generalReports.map((report) => (
            <ReportCard
              key={report.id}
              label={report.label}
              onOpen={() => setViewerReport(report)}
              onDownloadPdf={() => downloadReport(report)}
              onOpenPdf={() => openPdfInNewTab(report)}
            />
          ))}
        </div>
      </section>

      <ReportViewerModal
        open={!!viewerReport}
        onClose={() => setViewerReport(null)}
        reportId={viewerReport?.id ?? null}
        reportLabel={viewerReport?.label ?? ''}
        queryString={viewerReport ? buildQuery(viewerReport) : ''}
        onDownloadPdf={() => viewerReport && downloadReport(viewerReport)}
        onOpenPdf={() => viewerReport && openPdfInNewTab(viewerReport)}
      />

      <Modal
        open={!!filterModal}
        onClose={() => setFilterModal(null)}
        title="Filtros — Relatórios de Vencimento"
        size="lg"
      >
        <ExpirationReportFilters
          values={expirationFilters}
          onChange={setExpirationFilters}
          showDateRange={filterModal?.showDateRange ?? true}
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            variant="secondary"
            onClick={() => setExpirationFilters(defaultExpirationFilters)}
          >
            <X className="h-4 w-4" /> Limpar
          </Button>
          {filterModal && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setViewerReport(filterModal);
                  setFilterModal(null);
                }}
              >
                Ver em tela
              </Button>
              <Button onClick={() => openPdfInNewTab(filterModal)}>
                <Download className="h-4 w-4" /> Abrir PDF
              </Button>
              <Button onClick={() => { downloadReport(filterModal); setFilterModal(null); }}>
                <Download className="h-4 w-4" /> Baixar PDF
              </Button>
            </>
          )}
          <Button onClick={() => setFilterModal(null)}>Aplicar filtros</Button>
        </div>
      </Modal>
    </div>
  );
}
