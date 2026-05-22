export const EXPIRATION_ALERT_LABELS: Record<string, string> = {
  EXPIRED: 'Lote vencido',
  DAYS_7: 'Vence em até 7 dias',
  DAYS_30: 'Vence em até 30 dias',
  DAYS_60: 'Vence em até 60 dias',
  DAYS_90: 'Vence em até 90 dias',
};

export const SNOOZE_PRESETS = [
  { value: '4h', label: 'Em 4 horas' },
  { value: '1d', label: 'Amanhã' },
  { value: '3d', label: 'Em 3 dias' },
  { value: '7d', label: 'Em 1 semana' },
] as const;
