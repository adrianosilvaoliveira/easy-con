const CONNECTION_ERROR_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1008',
  'P1011',
  'P1017',
  'P2021',
  'P2024',
]);

export function getPrismaErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

export function isPrismaConnectionError(err: unknown): boolean {
  const code = getPrismaErrorCode(err);
  return code != null && CONNECTION_ERROR_CODES.has(code);
}
