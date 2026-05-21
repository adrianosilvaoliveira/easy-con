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

export function validateExpirationDate(expirationDate: Date, manufacturingDate?: Date | null): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  if (exp < today) {
    throw new Error('Não é permitido entrada com validade vencida');
  }
  if (manufacturingDate) {
    const mfg = new Date(manufacturingDate);
    mfg.setHours(0, 0, 0, 0);
    if (mfg >= exp) {
      throw new Error('Data de fabricação deve ser anterior à validade');
    }
  }
}

export const statusLabel: Record<ExpirationStatus, string> = {
  VALID: 'Dentro da validade',
  WARNING: 'Atenção',
  CRITICAL: 'Crítico',
  EXPIRED: 'Vencido',
};
