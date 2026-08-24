/**
 * Gera src/index.mjs (API + dependencias) para a lambda da Vercel.
 * Prisma fica externo: o query engine nao pode ser bundleado.
 *
 * pdfkit aponta para o build standalone (fontes AFM embutidas). O ESM
 * do pacote usa fs.readFileSync(__dirname + '/data/*.afm') e quebra no
 * bundle com "Dynamic require of stream" / ENOENT nas fontes.
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
  alias: {
    pdfkit: path.join(root, 'node_modules/pdfkit/js/pdfkit.standalone.js'),
  },
  logLevel: 'info',
});

console.log('[bundle-vercel] wrote src/index.mjs');
