import { ExpirationAlertType, ExpirationStatus } from '@prisma/client';

export function daysUntilExpiration(expirationDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function calculateExpirationStatus(expirationDate: Date): ExpirationStatus {
  const days = daysUntilExpiration(expirationDate);
  if (days < 0) return 'EXPIRED';
  if (days <= 30) return 'CRITICAL';
  if (days <= 90) return 'WARNING';
  return 'VALID';
}

export function getApplicableAlertTypes(expirationDate: Date): ExpirationAlertType[] {
  const days = daysUntilExpiration(expirationDate);
  const types: ExpirationAlertType[] = [];
  if (days < 0) {
    types.push('EXPIRED');
    return types;
  }
  if (days <= 7) types.push('DAYS_7');
  if (days <= 30) types.push('DAYS_30');
  if (days <= 60) types.push('DAYS_60');
  if (days <= 90) types.push('DAYS_90');
  return types;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function validateManufacturingBeforeExpiration(
  expirationDate: Date,
  manufacturingDate?: Date | null
): void {
  if (!manufacturingDate) return;
  const exp = startOfDay(expirationDate);
  const mfg = startOfDay(manufacturingDate);
  if (Number.isNaN(exp.getTime()) || Number.isNaN(mfg.getTime())) {
    throw new Error('Data inválida');
  }
  if (mfg >= exp) {
    throw new Error('Data de fabricação deve ser anterior à validade');
  }
}

export function validateExpirationDate(expirationDate: Date, manufacturingDate?: Date | null): void {
  const today = startOfDay(new Date());
  const exp = startOfDay(expirationDate);
  if (Number.isNaN(exp.getTime())) {
    throw new Error('Data de validade inválida');
  }
  if (exp < today) {
    throw new Error('Não é permitido entrada com validade vencida');
  }
  validateManufacturingBeforeExpiration(expirationDate, manufacturingDate);
}

export const statusLabel: Record<ExpirationStatus, string> = {
  VALID: 'Dentro da validade',
  WARNING: 'Atenção',
  CRITICAL: 'Crítico',
  EXPIRED: 'Vencido',
};
