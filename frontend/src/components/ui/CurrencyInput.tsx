import { cn } from '@/utils/cn';
import { InputHTMLAttributes, forwardRef } from 'react';
import {
  formatCurrencyInput,
  parseCurrencyInput,
  MAX_UNIT_PRICE,
} from '@/utils/format';

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label?: string;
  error?: string;
  value?: number | '' | null;
  onChange?: (value: number | undefined) => void;
  /** Valor máximo em reais (padrão: 100.000,00). */
  max?: number;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      label,
      error,
      id,
      value,
      onChange,
      onBlur,
      max = MAX_UNIT_PRICE,
      ...props
    },
    ref
  ) => {
    let display = '';
    if (value !== undefined && value !== null && value !== '') {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) {
        display = formatCurrencyInput(Math.round(num * 100));
      }
    }

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          className={cn(
            'input-field',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className
          )}
          onChange={(e) => {
            const parsed = parseCurrencyInput(e.target.value);
            if (parsed === undefined) {
              onChange?.(undefined);
              return;
            }
            onChange?.(Math.min(parsed, max));
          }}
          onBlur={onBlur}
          {...props}
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
