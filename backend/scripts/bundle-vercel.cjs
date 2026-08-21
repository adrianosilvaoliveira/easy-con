/**
 * Gera src/index.mjs (API + dependencias) para a lambda da Vercel.
 * Prisma fica externo: o query engine nao pode ser bundleado.
 */
const { buildSync } = require('esbuild');
const path = require('path');

const root = path.join(__dirname, '..');

buildSync({
  absWorkingDir: root,
  entryPoints: ['src/vercel-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'src/index.mjs',
  sourcemap: false,
  external: ['@prisma/client'],
  logLevel: 'info',
});

console.log('[bundle-vercel] wrote src/index.mjs');
