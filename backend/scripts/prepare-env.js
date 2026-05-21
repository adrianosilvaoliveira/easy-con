/** Mapeia variáveis do Vercel Postgres antes do Prisma CLI (build/migrate). */
if (!process.env.DATABASE_URL && process.env.PRISMA_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL;
}
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL;
}
