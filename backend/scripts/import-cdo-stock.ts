/**
 * Zera o estoque atual e recria saldos a partir da planilha CDO.
 * Lotes e vencimentos usam valores genéricos (obrigatórios no schema).
 *
 * Uso:
 *   npx tsx scripts/import-cdo-stock.ts "c:\Users\Adriano\Downloads\produtos cdo.xls" --yes
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { calculateExpirationStatus } from '../src/shared/utils/expiration';

const prisma = new PrismaClient();

interface SheetRow {
  code: string;
  name: string;
  brand: string;
  stock: number;
}

function readSheet(filePath: string): SheetRow[] {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return raw
    .map((row) => {
      const codeKey = Object.keys(row).find((k) => /c.digo/i.test(k)) ?? 'Código';
      const nameKey = Object.keys(row).find((k) => /descri/i.test(k)) ?? 'Descrição';
      const brandKey = Object.keys(row).find((k) => /marca/i.test(k)) ?? 'Marca';
      const stockKey = Object.keys(row).find((k) => /estoque/i.test(k)) ?? 'Estoque';
      return {
        code: String(row[codeKey] ?? '').trim(),
        name: String(row[nameKey] ?? '').trim(),
        brand: String(row[brandKey] ?? '').trim(),
        stock: Math.max(0, Math.floor(Number(row[stockKey] ?? 0))),
      };
    })
    .filter((r) => r.code && r.name);
}

async function clearStock() {
  console.log('🧹 Limpando estoque atual...');
  const run = async () => ({
    expirationAlerts: await prisma.expirationAlert.deleteMany(),
    stockMovements: await prisma.stockMovement.deleteMany(),
    inventoryItems: await prisma.inventoryItem.deleteMany(),
    inventories: await prisma.inventory.deleteMany(),
    stockItems: await prisma.stockItem.deleteMany(),
    productBatches: await prisma.productBatch.deleteMany(),
  });

  let counts;
  try {
    counts = await prisma.$transaction(run, { maxWait: 60_000, timeout: 120_000 });
  } catch {
    counts = await run();
  }

  console.log(`   Itens estoque: ${counts.stockItems.count}`);
  console.log(`   Lotes: ${counts.productBatches.count}`);
  console.log(`   Movimentações: ${counts.stockMovements.count}`);
}

async function main() {
  const confirmed = process.argv.includes('--yes') || process.env.IMPORT_CDO_STOCK_YES === '1';
  if (!confirmed) {
    console.error('Confirme com --yes ou IMPORT_CDO_STOCK_YES=1');
    process.exit(1);
  }

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const xlsPath =
    args[0] ?? path.join(process.env.USERPROFILE ?? '', 'Downloads', 'produtos cdo.xls');

  if (!fs.existsSync(xlsPath)) {
    console.error('Arquivo não encontrado:', xlsPath);
    process.exit(1);
  }

  const sheetRows = readSheet(xlsPath);
  console.log(`📋 Planilha: ${sheetRows.length} produtos (${xlsPath})`);

  await clearStock();

  const central = await prisma.stockLocation.findUnique({ where: { code: 'CENTRAL' } });
  if (!central) throw new Error('Local CENTRAL não encontrado');

  const products = await prisma.product.findMany({
    select: { id: true, internalCode: true },
  });
  const prodByCode = new Map(products.map((p) => [p.internalCode, p.id]));

  const placeholderExpiry = new Date('2099-12-31');
  const batchStatus = calculateExpirationStatus(placeholderExpiry);

  let imported = 0;
  let zeroStock = 0;
  let missing = 0;
  let totalQty = 0;

  const BATCH = 20;
  for (let offset = 0; offset < sheetRows.length; offset += BATCH) {
    const chunk = sheetRows.slice(offset, offset + BATCH);
    await prisma.$transaction(
      async (tx) => {
        for (const row of chunk) {
          const productId = prodByCode.get(row.code);
          if (!productId) {
            missing++;
            continue;
          }

          if (row.stock <= 0) {
            zeroStock++;
            continue;
          }

          const batchNumber = `CDO-${row.code}`;
          const batch = await tx.productBatch.create({
            data: {
              productId,
              stockLocationId: central.id,
              batchNumber,
              expirationDate: placeholderExpiry,
              quantity: row.stock,
              status: batchStatus,
            },
          });

          await tx.stockItem.create({
            data: {
              productId,
              locationId: central.id,
              batchId: batch.id,
              quantity: row.stock,
            },
          });

          imported++;
          totalQty += row.stock;
        }
      },
      { timeout: 120_000, maxWait: 30_000 }
    );
    process.stdout.write(`\r   ${Math.min(offset + BATCH, sheetRows.length)}/${sheetRows.length}`);
  }
  console.log('');

  console.log('✅ Estoque recriado a partir da planilha CDO');
  console.log(`   Com saldo: ${imported} produtos (${totalQty} unidades)`);
  console.log(`   Sem saldo na planilha: ${zeroStock}`);
  if (missing) console.log(`   ⚠ Código não encontrado no banco: ${missing}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
