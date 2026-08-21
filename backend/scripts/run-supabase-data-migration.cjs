/**
 * Migra dados Prisma Postgres -> Supabase durante o vercel-build.
 * Usa envs injetadas na Vercel (secrets sensíveis não saem via CLI).
 *
 * SOURCE: DATABASE_URL | PRISMA_DATABASE_URL | POSTGRES_URL (Prisma Postgres)
 * TARGET: ARMAZENAMENTO_POSTGRES_URL_NON_POOLING | ARMAZENAMENTO_POSTGRES_URL
 *
 * Idempotente: se o destino já tiver usuários, não faz nada.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
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
  '_prisma_migrations',
];

function pick(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim() && v !== '[SENSITIVE]') return String(v).trim();
  }
  return null;
}

function normalizeUrl(url) {
  if (!url) return url;
  // Strip sslmode so node-pg does not force verify-full (breaks Supabase pooler chain).
  let u = url.replace(/([?&])sslmode=[^&]*/gi, '$1').replace(/[?&]$/, '');
  u = u.replace(/\?&/, '?').replace(/&&/, '&');
  return u;
}

function pgClient(connectionString) {
  return new Client({
    connectionString: normalizeUrl(connectionString),
    ssl: { rejectUnauthorized: false },
  });
}

async function tableExists(client, table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return r.rowCount > 0;
}

async function countRows(client, table) {
  if (!(await tableExists(client, table))) return null;
  const r = await client.query(`SELECT COUNT(*)::int AS c FROM public."${table}"`);
  return r.rows[0].c;
}

async function main() {
  // Build images on Vercel may reject Supabase's cert chain without this.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const sourceUrl = pick('PRISMA_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL');
  const targetUrl = pick(
    'ARMAZENAMENTO_POSTGRES_URL_NON_POOLING',
    'ARMAZENAMENTO_POSTGRES_URL',
  );

  if (!targetUrl) {
    console.log('[supabase-migrate] Sem ARMAZENAMENTO_POSTGRES_* — skip.');
    return;
  }
  if (!sourceUrl) {
    console.log('[supabase-migrate] Sem URL de origem — skip.');
    return;
  }

  const sourceHost = (sourceUrl.match(/@([^:/?]+)/) || [])[1] || '?';
  const targetHost = (targetUrl.match(/@([^:/?]+)/) || [])[1] || '?';
  console.log(`[supabase-migrate] source=${sourceHost} → target=${targetHost}`);

  if (sourceHost === targetHost) {
    console.log('[supabase-migrate] Origem e destino iguais — skip.');
    return;
  }

  const target = pgClient(targetUrl);
  await target.connect();

  try {
    const targetUsers = await countRows(target, 'users');
    if (targetUsers !== null && targetUsers > 0) {
      console.log(
        `[supabase-migrate] Destino já tem ${targetUsers} users — skip (idempotente).`,
      );
      return;
    }

    console.log('[supabase-migrate] Aplicando schema (prisma db push)...');
    const push = spawnSync(
      'npx',
      ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'],
      {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          DATABASE_URL: targetUrl,
          DIRECT_URL: targetUrl,
        },
        encoding: 'utf8',
        shell: true,
      },
    );
    if (push.stdout) process.stdout.write(push.stdout);
    if (push.stderr) process.stderr.write(push.stderr);
    if (push.status !== 0) {
      throw new Error(`prisma db push falhou (exit ${push.status})`);
    }

    const source = pgClient(sourceUrl);
    await source.connect();

    try {
      const sourceUsers = await countRows(source, 'users');
      if (!sourceUsers) {
        throw new Error('Origem sem users — abortando para não sobrescrever com vazio.');
      }
      console.log(`[supabase-migrate] Origem users=${sourceUsers}`);

      console.log('[supabase-migrate] Truncando destino...');
      await target.query('BEGIN');
      await target.query(
        `DO $$ DECLARE r RECORD; BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
            EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;`,
      );

      const copied = {};
      for (const table of TABLES) {
        if (!(await tableExists(source, table))) {
          console.log(`[supabase-migrate] skip missing source table: ${table}`);
          continue;
        }
        if (!(await tableExists(target, table))) {
          // _prisma_migrations pode não existir após db push em algumas versões
          if (table === '_prisma_migrations') {
            await target.query(`
              CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
                "id" VARCHAR(36) PRIMARY KEY,
                "checksum" VARCHAR(64) NOT NULL,
                "finished_at" TIMESTAMPTZ,
                "migration_name" VARCHAR(255) NOT NULL,
                "logs" TEXT,
                "rolled_back_at" TIMESTAMPTZ,
                "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "applied_steps_count" INTEGER NOT NULL DEFAULT 0
              );
            `);
          } else {
            console.log(`[supabase-migrate] skip missing target table: ${table}`);
            continue;
          }
        }

        const { rows } = await source.query(`SELECT * FROM public."${table}"`);
        if (rows.length === 0) {
          copied[table] = 0;
          continue;
        }

        const cols = Object.keys(rows[0]);
        const colList = cols.map((c) => `"${c}"`).join(', ');
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = [];
          const params = [];
          let p = 1;
          for (const row of batch) {
            const ph = cols.map(() => `$${p++}`);
            values.push(`(${ph.join(', ')})`);
            for (const c of cols) params.push(row[c]);
          }
          await target.query(
            `INSERT INTO public."${table}" (${colList}) VALUES ${values.join(', ')}`,
            params,
          );
        }
        copied[table] = rows.length;
        console.log(`[supabase-migrate] ${table}: ${rows.length}`);
      }

      await target.query('COMMIT');
      console.log('[supabase-migrate] COPY ok', copied);

      // Alinha histórico Prisma se a origem não tinha _prisma_migrations completo
      const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
      if (fs.existsSync(migrationsDir)) {
        const dirs = fs
          .readdirSync(migrationsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort();
        for (const name of dirs) {
          const resolve = spawnSync(
            'npx',
            ['prisma', 'migrate', 'resolve', '--applied', name],
            {
              cwd: path.join(__dirname, '..'),
              env: {
                ...process.env,
                DATABASE_URL: targetUrl,
                DIRECT_URL: targetUrl,
              },
              encoding: 'utf8',
              shell: true,
            },
          );
          if (resolve.status !== 0) {
            // Já aplicado via copy — ok
            console.log(
              `[supabase-migrate] resolve ${name}: ${(resolve.stderr || resolve.stdout || '').split('\n')[0]}`,
            );
          } else {
            console.log(`[supabase-migrate] resolve applied: ${name}`);
          }
        }
      }

      const afterUsers = await countRows(target, 'users');
      const afterProducts = await countRows(target, 'products');
      const afterMovements = await countRows(target, 'stock_movements');
      console.log(
        `[supabase-migrate] validação destino users=${afterUsers} products=${afterProducts} movements=${afterMovements}`,
      );
      if (afterUsers !== sourceUsers) {
        throw new Error(
          `Contagem users divergente: source=${sourceUsers} target=${afterUsers}`,
        );
      }
    } catch (e) {
      try {
        await target.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    } finally {
      await source.end();
    }
  } finally {
    await target.end();
  }

  console.log('[supabase-migrate] Concluído.');
}

main().catch((err) => {
  console.error('[supabase-migrate] ERRO:', err);
  process.exit(1);
});
