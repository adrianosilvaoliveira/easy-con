import type { StockOriginOption } from '@/hooks/queries/useProductStockOrigins';

type StockOriginSelectProps = {
  value?: string;
  onChange: (locationId: string) => void;
  origins: StockOriginOption[];
  productSelected: boolean;
  loading?: boolean;
  error?: string;
  label?: string;
  disabled?: boolean;
};

export function StockOriginSelect({
  value,
  onChange,
  origins,
  productSelected,
  loading,
  error,
  label = 'Origem',
  disabled,
}: StockOriginSelectProps) {
  return (
    <div>
      <label className="form-label">{label} *</label>
      <select
        className="input-field"
        value={value || ''}
        disabled={disabled || !productSelected || loading}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        <option value="">
          {!productSelected
            ? 'Selecione o produto primeiro'
            : loading
              ? 'Carregando estoque...'
              : origins.length === 0
                ? 'Sem estoque disponível'
                : 'Selecione o local...'}
        </option>
        {origins.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({l.quantity} un.)
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {productSelected && !loading && origins.length > 1 && (
        <p className="mt-1 text-xs text-slate-500">
          Produto disponível em {origins.length} locais. Escolha de onde movimentar.
        </p>
      )}
    </div>
  );
}
