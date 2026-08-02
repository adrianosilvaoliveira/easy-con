/**
 * Conta linhas das tabelas principais. Usa DATABASE_URL/DIRECT_URL do ambiente.
 * Uso: npx tsx scripts/count-db-rows.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const models = [
  'user',
  'role',
  'permission',
  'userPermission',
  'rolePermission',
  'refreshToken',
  'passwordReset',
  'category',
  'supplier',
  'product',
  'productKitItem',
  'productBatch',
  'expirationAlert',
  'stockLocation',
  'stockItem',
  'stockMovement',
  'inventory',
  'inventoryItem',
  'organizationSettings',
  'auditLog',
] as const;

async function main() {
  for (const name of models) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (prisma as any)[name].count();
      console.log(`${name}: ${count}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
      console.log(`${name}: ERR ${msg}`);
    }
  }
}

main()
  .finally(() => prisma.$disconnect());
