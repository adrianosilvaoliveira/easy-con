/**
 * Mapeia variáveis do Vercel Storage / Supabase antes do Prisma CLI (build/migrate).
 * Prefere ARMAZENAMENTO_* (Supabase) quando presentes, senão POSTGRES_* / PRISMA_*.
 * Grava `.env` para que o processo seguinte (`prisma …`) veja as URLs corretas.
 */
const fs = require('fs');
const path = require('path');

function has(v) {
  return Boolean(v && String(v).trim() && v !== '[SENSITIVE]');
}

if (has(process.env.ARMAZENAMENTO_POSTGRES_PRISMA_URL)) {
  process.env.DATABASE_URL = process.env.ARMAZENAMENTO_POSTGRES_PRISMA_URL;
} else if (has(process.env.ARMAZENAMENTO_POSTGRES_URL)) {
  process.env.DATABASE_URL = process.env.ARMAZENAMENTO_POSTGRES_URL;
} else if (!has(process.env.DATABASE_URL) && has(process.env.PRISMA_DATABASE_URL)) {
  process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL;
} else if (!has(process.env.DATABASE_URL) && has(process.env.POSTGRES_PRISMA_URL)) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}

if (has(process.env.ARMAZENAMENTO_POSTGRES_URL_NON_POOLING)) {
  process.env.DIRECT_URL = process.env.ARMAZENAMENTO_POSTGRES_URL_NON_POOLING;
} else if (has(process.env.ARMAZENAMENTO_POSTGRES_URL) && !has(process.env.DIRECT_URL)) {
  process.env.DIRECT_URL = process.env.ARMAZENAMENTO_POSTGRES_URL;
} else if (!has(process.env.DIRECT_URL) && has(process.env.POSTGRES_URL_NON_POOLING)) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
} else if (!has(process.env.DIRECT_URL) && has(process.env.POSTGRES_URL)) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL;
}

if (!has(process.env.DIRECT_URL) && has(process.env.DATABASE_URL)) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const dbHost = ((process.env.DATABASE_URL || '').match(/@([^:/?]+)/) || [])[1] || '(none)';
const directHost = ((process.env.DIRECT_URL || '').match(/@([^:/?]+)/) || [])[1] || '(none)';
console.log(`[prepare-env] DATABASE_URL host=${dbHost} DIRECT_URL host=${directHost}`);

if (has(process.env.DATABASE_URL) && has(process.env.DIRECT_URL)) {
  const envPath = path.join(__dirname, '..', '.env');
  const body = [
    `# Gerado por scripts/prepare-env.js no build — nao editar`,
    `DATABASE_URL="${process.env.DATABASE_URL}"`,
    `DIRECT_URL="${process.env.DIRECT_URL}"`,
    '',
  ].join('\n');
  fs.writeFileSync(envPath, body, 'utf8');
  console.log('[prepare-env] Wrote .env for Prisma CLI');
}
