/**
 * Compara contagens Prisma Postgres (origem) vs Supabase (destino).
 * Roda no vercel-build (onde ARMAZENAMENTO_* existe). Só loga — não altera dados.
 *
 * Uso local (se tiver URLs): node scripts/compare-prod-dbs.js
 */
const { Client } = require('pg');

const TABLES = [
  'roles',
  'permissions',
  'role_permissions',
  'users',
  'user_permissions',
  'refresh_tokens',
  'password_resets',
  'categories',
  'suppliers',
  'stock_locations',
  'products',
  'product_batches',
  'product_kit_items',
  'stock_items',
  'stock_movements',
  'inventories',
  'inventory_items',
  'expiration_alerts',
  'organization_settings',
  'audit_logs',
];

function pick(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim() && v !== '[SENSITIVE]') return String(v).trim();
  }
  return null;
}

function host(url) {
  return ((url || '').match(/@([^:/?]+)/) || [])[1] || '(none)';
}

function normalizeUrl(url) {
  if (!url) return url;
  let u = url.replace(/([?&])sslmode=[^&]*/gi, '$1').replace(/[?&]$/, '');
  return u.replace(/\?&/, '?').replace(/&&/, '&');
}

function pgClient(connectionString) {
  return new Client({
    connectionString: normalizeUrl(connectionString),
    ssl: { rejectUnauthorized: false },
  });
}

async function counts(client) {
  const out = {};
  for (const table of TABLES) {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS c FROM public."${table}"`);
      out[table] = r.rows[0].c;
    } catch {
      out[table] = null;
    }
  }
  return out;
}

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const supabaseUrl = pick(
    'ARMAZENAMENTO_POSTGRES_URL_NON_POOLING',
    'ARMAZENAMENTO_POSTGRES_PRISMA_URL',
    'ARMAZENAMENTO_POSTGRES_URL',
  );
  const prismaUrl = pick('PRISMA_DATABASE_URL', 'POSTGRES_URL', 'DATABASE_URL');

  console.log(`[compare-dbs] supabase host=${host(supabaseUrl)}`);
  console.log(`[compare-dbs] prisma/legacy host=${host(prismaUrl)}`);

  if (!supabaseUrl) {
    console.log('[compare-dbs] CUTOVER_BLOCKED: Sem URL Supabase (ARMAZENAMENTO_*).');
    return;
  }

  const supabase = pgClient(supabaseUrl);
  await supabase.connect();
  const sCounts = await counts(supabase);
  await supabase.end();

  let pCounts = null;
  if (prismaUrl && host(prismaUrl) !== host(supabaseUrl)) {
    try {
      const prisma = pgClient(prismaUrl);
      await prisma.connect();
      pCounts = await counts(prisma);
      await prisma.end();
    } catch (e) {
      console.log(`[compare-dbs] Prisma inacessivel: ${e.message}`);
    }
  }

  let mismatches = 0;
  let supabaseBehind = 0;
  console.log('[compare-dbs] --- table | supabase | prisma ---');
  for (const t of TABLES) {
    const s = sCounts[t];
    const p = pCounts ? pCounts[t] : 'n/a';
    let mark = '';
    if (pCounts && s !== null && p !== null && s !== p) {
      mismatches += 1;
      if (s < p) {
        supabaseBehind += 1;
        mark = ' << SUPABASE_BEHIND';
      } else {
        mark = ' << supabase ahead (ok)';
      }
    }
    console.log(`[compare-dbs] ${t}: ${s} | ${p}${mark}`);
  }

  const users = sCounts.users || 0;
  const products = sCounts.products || 0;
  const movements = sCounts.stock_movements || 0;

  if (users < 1 || products < 1) {
    console.log('[compare-dbs] CUTOVER_BLOCKED: Supabase parece vazio ou incompleto.');
    return;
  }

  if (supabaseBehind > 0) {
    console.log(
      `[compare-dbs] CUTOVER_BLOCKED: ${supabaseBehind} tabelas no Supabase atrasadas vs Prisma — sincronize antes.`,
    );
    return;
  }

  if (mismatches > 0) {
    console.log(
      `[compare-dbs] OK: ${mismatches} divergencias, todas com Supabase >= Prisma (producao viva no Supabase).`,
    );
  } else {
    console.log('[compare-dbs] OK: Supabase populado' + (pCounts ? ' e alinhado ao Prisma.' : '.'));
  }
  console.log(
    `[compare-dbs] CUTOVER_READY users=${users} products=${products} movements=${movements}`,
  );
}

main().catch((e) => {
  console.error('[compare-dbs] ERROR', e);
  // Nao derruba o build — so diagnostico
});
