import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** Queries acima deste limite são registradas como lentas para observabilidade. */
const SLOW_QUERY_MS = 500;

function createPrismaClient() {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
    ],
  });

  client.$on('query', (e) => {
    if (e.duration >= SLOW_QUERY_MS) {
      logger.warn('Slow query', { durationMs: e.duration, query: e.query });
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Em serverless (Vercel), não encerra o processo — a conexão é lazy por requisição. */
if (!process.env.VERCEL) {
  prisma.$connect().catch((err) => {
    logger.error('Failed to connect to database', err);
    process.exit(1);
  });
}
