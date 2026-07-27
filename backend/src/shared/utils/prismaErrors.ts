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

/** Coluna inexistente / schema desatualizado (ex.: migration pendente). */
const SCHEMA_ERROR_CODES = new Set(['P2022']);

const TRANSIENT_MESSAGE_RE =
  /too many connections|connection terminated|connection reset|server closed the connection|prepared statement|can'?t reach database|cannot reach database|econnrefused|etimedout|socket hang up|timed out fetching a new connection|remaining connection slots/i;

export function getPrismaErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

export function isPrismaConnectionError(err: unknown): boolean {
  const code = getPrismaErrorCode(err);
  return code != null && CONNECTION_ERROR_CODES.has(code);
}

export function isPrismaSchemaError(err: unknown): boolean {
  const code = getPrismaErrorCode(err);
  return code != null && SCHEMA_ERROR_CODES.has(code);
}

/** Falhas de DB que costumam ser intermitentes no serverless (pool, rede, pgbouncer). */
export function isTransientDbError(err: unknown): boolean {
  if (isPrismaConnectionError(err)) return true;
  const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? '');
  return TRANSIENT_MESSAGE_RE.test(message);
}
