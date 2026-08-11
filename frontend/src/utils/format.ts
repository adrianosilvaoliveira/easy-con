import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/** Máximo padrão para valor unitário em entradas (R$ 100.000,00). */
export const MAX_UNIT_PRICE = 100_000;

/** Formata centavos digitados como moeda BRL (ex.: 12345 → R$ 123,45). */
export function formatCurrencyInput(cents: number): string {
  return formatCurrency(cents / 100);
}

/** Extrai dígitos e converte para valor em reais (centavos / 100). */
export function parseCurrencyInput(raw: string): number | undefined {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;
  return Number(digits) / 100;
}

export function formatProductName(name: string): string {
  return name.trim().toLocaleUpperCase('pt-BR');
}

/** Formatação durante digitação — mantém espaços internos. */
export function formatProductNameInput(name: string): string {
  return name.toLocaleUpperCase('pt-BR');
}

export function movementTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

export function movementStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDENTE: 'Pendente',
    APROVADA: 'Aprovada',
    REJEITADA: 'Rejeitada',
    CONCLUIDA: 'Concluída',
  };
  return labels[status] ?? status;
}
