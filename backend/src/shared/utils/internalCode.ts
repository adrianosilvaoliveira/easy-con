import { prisma } from '../../database/prisma';
import { ValidationError } from '../errors/AppError';

const AUTO_PREFIX = 'AUTO-';

/** Gera código interno único no formato AUTO-000001, AUTO-000002, … */
export async function generateInternalCode(): Promise<string> {
  const latest = await prisma.product.findFirst({
    where: { internalCode: { startsWith: AUTO_PREFIX } },
    orderBy: { internalCode: 'desc' },
    select: { internalCode: true },
  });

  let next = 1;
  if (latest?.internalCode) {
    const match = latest.internalCode.match(/^AUTO-(\d+)$/);
    if (match) next = parseInt(match[1], 10) + 1;
  }

  for (let attempt = 0; attempt < 100; attempt++) {
    const code = `${AUTO_PREFIX}${String(next + attempt).padStart(6, '0')}`;
    const exists = await prisma.product.findUnique({ where: { internalCode: code } });
    if (!exists) return code;
  }

  throw new ValidationError('Não foi possível gerar código interno automaticamente');
}

export function normalizeInternalCode(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
