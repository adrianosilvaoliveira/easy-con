import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
  });

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
