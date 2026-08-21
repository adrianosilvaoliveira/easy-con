/**
 * Stub para o clone da Vercel (o path do entrypoint precisa existir).
 * No vercel-build, scripts/bundle-vercel.cjs substitui este arquivo pelo bundle.
 */
module.exports = function vercelLambdaStub(_req, _res) {
  throw new Error('API bundle ausente: rode node scripts/bundle-vercel.cjs');
};
