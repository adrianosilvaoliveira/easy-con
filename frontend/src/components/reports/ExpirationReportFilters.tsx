import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { SupplierSearchSelect } from '@/components/suppliers/SupplierSearchSelect';

export interface ExpirationReportFilterValues {
  productId?: string;
  categoryId?: string;
  supplierId?: string;
  stockLocationId?: string;
  batchNumber?: string;
  status?: string;
  expirationFrom?: string;
  expirationTo?: string;
  expiringDays?: string;
  onlyExpired?: boolean;
  onlyExpiring?: boolean;
  startDate?: string;
  endDate?: string;
}

interface Props {
  values: ExpirationReportFilterValues;
  onChange: (values: ExpirationReportFilterValues) => void;
  showDateRange?: boolean;
}

export function ExpirationReportFilters({ values, onChange, showDateRange }: Props) {
  const { data: products } = useQuery({
    queryKey: ['report-products'],
    queryFn: () => api.get('/products', { params: { limit: 300 } }).then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['report-categories'],
    queryFn: () => api.get('/products/categories').then((r) => r.data.data),
  });

  const { data: locations } = useQuery({
    queryKey: ['report-locations'],
    queryFn: () => api.get('/stock/locations').then((r) => r.data.data),
  });

  const set = (patch: Partial<ExpirationReportFilterValues>) =>
    onChange({ ...values, ...patch });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Produto</label>
        <select
          className="input-field text-sm"
          value={values.productId || ''}
          onChange={(e) => set({ productId: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {products?.map((p: { id: string; name: string; internalCode: string }) => (
            <option key={p.id} value={p.id}>
              {p.internalCode} — {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Categoria</label>
        <select
          className="input-field text-sm"
          value={values.categoryId || ''}
          onChange={(e) => set({ categoryId: e.target.value || undefined })}
        >
          <option value="">Todas</option>
          {categories?.map((c: { id: string; name: string }) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <SupplierSearchSelect
          label="Fornecedor"
          value={values.supplierId || ''}
          onChange={(id) => set({ supplierId: id || undefined })}
          placeholder="Filtrar por fornecedor..."
          allowClear
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Local de estoque</label>
        <select
          className="input-field text-sm"
          value={values.stockLocationId || ''}
          onChange={(e) => set({ stockLocationId: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {locations?.map((l: { id: string; name: string }) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Nº do lote</label>
        <input
          className="input-field text-sm"
          placeholder="Ex: LOTE-001"
          value={values.batchNumber || ''}
          onChange={(e) => set({ batchNumber: e.target.value || undefined })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Status vencimento</label>
        <select
          className="input-field text-sm"
          value={values.status || ''}
          onChange={(e) => set({ status: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          <option value="VALID">Dentro da validade</option>
          <option value="WARNING">Atenção (90d)</option>
          <option value="CRITICAL">Crítico (30d)</option>
          <option value="EXPIRED">Vencido</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Validade de</label>
        <input
          type="date"
          className="input-field text-sm"
          value={values.expirationFrom || ''}
          onChange={(e) => set({ expirationFrom: e.target.value || undefined })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Validade até</label>
        <input
          type="date"
          className="input-field text-sm"
          value={values.expirationTo || ''}
          onChange={(e) => set({ expirationTo: e.target.value || undefined })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Vencendo em (dias)</label>
        <input
          type="number"
          min={1}
          className="input-field text-sm"
          placeholder="90"
          value={values.expiringDays || ''}
          onChange={(e) => set({ expiringDays: e.target.value || undefined })}
        />
      </div>
      {showDateRange && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Período de</label>
            <input
              type="date"
              className="input-field text-sm"
              value={values.startDate || ''}
              onChange={(e) => set({ startDate: e.target.value || undefined })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Período até</label>
            <input
              type="date"
              className="input-field text-sm"
              value={values.endDate || ''}
              onChange={(e) => set({ endDate: e.target.value || undefined })}
            />
          </div>
        </>
      )}
      <div className="flex flex-wrap items-end gap-4 sm:col-span-2 lg:col-span-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!values.onlyExpired}
            onChange={(e) =>
              set({
                onlyExpired: e.target.checked,
                onlyExpiring: e.target.checked ? false : values.onlyExpiring,
              })
            }
          />
          Somente vencidos
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!values.onlyExpiring}
            onChange={(e) =>
              set({
                onlyExpiring: e.target.checked,
                onlyExpired: e.target.checked ? false : values.onlyExpired,
              })
            }
          />
          Somente a vencer
        </label>
      </div>
    </div>
  );
}

export function filtersToQueryParams(
  values: ExpirationReportFilterValues
): Record<string, string> {
  const params: Record<string, string> = {};
  if (values.productId) params.productId = values.productId;
  if (values.categoryId) params.categoryId = values.categoryId;
  if (values.supplierId) params.supplierId = values.supplierId;
  if (values.stockLocationId) params.stockLocationId = values.stockLocationId;
  if (values.batchNumber) params.batchNumber = values.batchNumber;
  if (values.status) params.status = values.status;
  if (values.expirationFrom) params.expirationFrom = values.expirationFrom;
  if (values.expirationTo) params.expirationTo = values.expirationTo;
  if (values.expiringDays) params.expiringDays = values.expiringDays;
  if (values.startDate) params.startDate = values.startDate;
  if (values.endDate) params.endDate = values.endDate;
  if (values.onlyExpired) params.onlyExpired = 'true';
  if (values.onlyExpiring) params.onlyExpiring = 'true';
  return params;
}
