/** Limites de linhas por tipo de relatório — evita scans exagerados no Postgres. */
export const REPORT_LIMITS = {
  stock: 2000,
  movements: 500,
  batches: 1000,
  discarded: 1000,
  lossHistory: 1000,
  expirationAudit: 1000,
  audit: 500,
} as const;
