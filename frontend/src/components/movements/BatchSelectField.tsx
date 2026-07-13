import { formatDate } from '@/utils/format';
import type { AvailableLot } from '@/hooks/queries/useAvailableLots';

type BatchSelectFieldProps = {
  lots: AvailableLot[];
  value?: string;
  onChange: (batchId: string) => void;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
};

export function BatchSelectField({
  lots,
  value,
  onChange,
  error,
  disabled,
  loading,
  required = true,
}: BatchSelectFieldProps) {
  if (lots.length <= 1) return null;

  return (
    <div className="sm:col-span-2">
      <label className="form-label">
        Lote {required ? '*' : ''}
      </label>
      <select
        className="input-field"
        value={value || ''}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">
          {loading ? 'Carregando lotes...' : 'Selecione o lote...'}
        </option>
        {lots.map((lot) => (
          <option key={lot.batchId} value={lot.batchId}>
            {lot.batchNumber}
            {lot.expirationDate ? ` — Val. ${formatDate(lot.expirationDate)}` : ''}
            {` (${lot.quantity} un.)`}
            {lot.status === 'EXPIRED' ? ' — Vencido' : ''}
            {lot.status === 'CRITICAL' || lot.status === 'WARNING' ? ' — Próximo do vencimento' : ''}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-slate-500">
        Este produto possui {lots.length} lotes neste local. Escolha qual lote movimentar.
      </p>
    </div>
  );
}
