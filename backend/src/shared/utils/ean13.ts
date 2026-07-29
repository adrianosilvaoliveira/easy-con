import { prisma } from '../../database/prisma';
import { ValidationError } from '../errors/AppError';

/** Prefixo de uso interno (GS1) para códigos gerados pelo sistema. */
const INTERNAL_PREFIX = '200';

function checkDigit(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits12[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return checkDigit(code.slice(0, 12)) === code[12];
}

/** Gera EAN-13 único (13 dígitos) para kits. */
export async function generateEan13Barcode(): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const random = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0');
    const body = `${INTERNAL_PREFIX}${random}`;
    const code = `${body}${checkDigit(body)}`;
    const exists = await prisma.product.findFirst({
      where: { barcode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new ValidationError('Não foi possível gerar código de barras automaticamente');
}
