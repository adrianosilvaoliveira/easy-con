import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ReportPreviewData {
  title: string;
  subtitle: string;
  columns: { header: string; key: string }[];
  rows: Record<string, string | number>[];
  generatedAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  reportId: string | null;
  reportLabel: string;
  queryString: string;
  onDownloadPdf: () => void;
  onOpenPdf: () => void;
}

export function ReportViewerModal({
  open,
  onClose,
  reportId,
  reportLabel,
  queryString,
  onDownloadPdf,
  onOpenPdf,
}: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['report-preview', reportId, queryString],
    queryFn: () =>
      api
        .get<{ data: ReportPreviewData }>(`/reports/${reportId}/preview${queryString}`)
        .then((r) => r.data.data),
    enabled: open && !!reportId,
  });

  return (
    <Modal open={open} onClose={onClose} title={reportLabel} size="2xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {data && (
              <>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{data.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{data.subtitle}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {data.rows.length} registro(s) ·{' '}
                  {new Date(data.generatedAt).toLocaleString('pt-BR')}
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onOpenPdf}>
              <ExternalLink className="h-4 w-4" /> Abrir PDF
            </Button>
            <Button size="sm" onClick={onDownloadPdf}>
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando relatório...
          </div>
        )}

        {isError && (
          <p className="py-12 text-center text-sm text-red-600 dark:text-red-400">
            Não foi possível carregar o relatório.
          </p>
        )}

        {data && !isLoading && (
          <div className="table-container max-h-[55vh] overflow-auto rounded-lg border border-surface-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/80">
                <tr className="border-b border-surface-border dark:border-slate-600">
                  {data.columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={data.columns.length}
                      className="px-4 py-12 text-center text-slate-400 dark:text-slate-500"
                    >
                      Nenhum registro encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row, i) => (
                    <tr key={i} className="border-b border-surface-border last:border-0 hover:bg-slate-50/80 dark:border-slate-700 dark:hover:bg-slate-700/50">
                      {data.columns.map((col) => (
                        <td key={col.key} className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">
                          {row[col.key] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
