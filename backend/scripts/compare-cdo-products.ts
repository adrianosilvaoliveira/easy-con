/**
 * Compara produtos da planilha CDO com o banco (produção via DATABASE_URL).
 * Uso: npx tsx scripts/compare-cdo-products.ts "c:\Users\Adriano\Downloads\produtos cdo.xls"
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { normalizeProductName } from '../src/shared/utils/productName';

const prisma = new PrismaClient();

interface SheetRow {
  code: string;
  name: string;
  brand: string;
  stock: number;
}

function norm(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function readSheet(filePath: string): SheetRow[] {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return raw.map((row) => {
    const codeKey = Object.keys(row).find((k) => /c.digo/i.test(k)) ?? 'Código';
    const nameKey = Object.keys(row).find((k) => /descri/i.test(k)) ?? 'Descrição';
    const brandKey = Object.keys(row).find((k) => /marca/i.test(k)) ?? 'Marca';
    const stockKey = Object.keys(row).find((k) => /estoque/i.test(k)) ?? 'Estoque';
    return {
      code: String(row[codeKey] ?? '').trim(),
      name: String(row[nameKey] ?? '').trim(),
      brand: String(row[brandKey] ?? '').trim(),
      stock: Number(row[stockKey] ?? 0),
    };
  }).filter((r) => r.code && r.name);
}

async function main() {
  const xlsPath = process.argv[2] ?? path.join(process.env.USERPROFILE ?? '', 'Downloads', 'produtos cdo.xls');
  if (!fs.existsSync(xlsPath)) {
    console.error('Arquivo não encontrado:', xlsPath);
    process.exit(1);
  }

  const sheetRows = readSheet(xlsPath);
  const sheetByCode = new Map(sheetRows.map((r) => [r.code, r]));

  const products = await prisma.product.findMany({
    select: {
      id: true,
      internalCode: true,
      name: true,
      manufacturer: true,
      active: true,
      stockItems: { select: { quantity: true } },
    },
    orderBy: { internalCode: 'asc' },
  });

  const prodByCode = new Map(products.map((p) => [p.internalCode, p]));

  const onlyInSheet: SheetRow[] = [];
  const onlyInDb: typeof products = [];
  const nameMismatch: Array<{ code: string; sheet: string; db: string }> = [];
  const brandMismatch: Array<{ code: string; sheet: string; db: string; name: string }> = [];
  const stockMismatch: Array<{ code: string; sheet: number; db: number; name: string }> = [];
  const matched: string[] = [];

  for (const row of sheetRows) {
    const p = prodByCode.get(row.code);
    if (!p) {
      onlyInSheet.push(row);
      continue;
    }
    const dbStock = p.stockItems.reduce((s, i) => s + i.quantity, 0);
    const sheetNameNorm = norm(normalizeProductName(row.name));
    const dbNameNorm = norm(p.name);
    const nameOk = sheetNameNorm === dbNameNorm || sheetNameNorm.includes(dbNameNorm) || dbNameNorm.includes(sheetNameNorm);
    if (!nameOk) {
      nameMismatch.push({ code: row.code, sheet: row.name, db: p.name });
    }
    const sheetBrand = norm(row.brand);
    const dbBrand = norm(p.manufacturer);
    if (sheetBrand && dbBrand && sheetBrand !== dbBrand) {
      brandMismatch.push({ code: row.code, sheet: row.brand, db: p.manufacturer ?? '', name: row.name });
    }
    if (row.stock !== dbStock) {
      stockMismatch.push({ code: row.code, sheet: row.stock, db: dbStock, name: row.name });
    }
    if (nameOk) matched.push(row.code);
  }

  for (const p of products) {
    if (!sheetByCode.has(p.internalCode)) onlyInDb.push(p);
  }

  const inactiveInDb = products.filter((p) => !p.active);

  const report = {
    generatedAt: new Date().toISOString(),
    spreadsheet: { file: xlsPath, total: sheetRows.length },
    database: { total: products.length, active: products.filter((p) => p.active).length, inactive: inactiveInDb.length },
    summary: {
      matchedByCode: sheetRows.length - onlyInSheet.length,
      onlyInSpreadsheet: onlyInSheet.length,
      onlyInDatabase: onlyInDb.length,
      nameDifferences: nameMismatch.length,
      brandDifferences: brandMismatch.length,
      stockDifferences: stockMismatch.length,
    },
    onlyInSpreadsheet: onlyInSheet.map((r) => ({ code: r.code, name: r.name, brand: r.brand, stock: r.stock })),
    onlyInDatabase: onlyInDb.map((p) => ({
      code: p.internalCode,
      name: p.name,
      brand: p.manufacturer,
      active: p.active,
      stock: p.stockItems.reduce((s, i) => s + i.quantity, 0),
    })),
    nameDifferences: nameMismatch,
    brandDifferences: brandMismatch.slice(0, 30),
    stockDifferences: stockMismatch
      .sort((a, b) => Math.abs(b.sheet - b.db) - Math.abs(a.sheet - a.db))
      .slice(0, 40),
  };

  const outPath = path.join(__dirname, 'data', 'cdo-comparison-report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('=== COMPARAÇÃO PLANILHA CDO x PRODUÇÃO ===\n');
  console.log(`Planilha: ${sheetRows.length} produtos`);
  console.log(`Banco (produção): ${products.length} produtos (${inactiveInDb.length} inativos)\n`);
  console.log(`✓ Mesmo código na planilha e no banco: ${report.summary.matchedByCode}`);
  console.log(`✗ Só na planilha (faltam cadastrar): ${onlyInSheet.length}`);
  console.log(`✗ Só no banco (não estão na planilha): ${onlyInDb.length}`);
  console.log(`⚠ Nome diferente (mesmo código): ${nameMismatch.length}`);
  console.log(`⚠ Marca/fornecedor diferente: ${brandMismatch.length}`);
  console.log(`⚠ Estoque diferente: ${stockMismatch.length}`);
  console.log(`\nRelatório completo: ${outPath}`);

  if (onlyInSheet.length) {
    console.log('\n--- Só na planilha (primeiros 15) ---');
    onlyInSheet.slice(0, 15).forEach((r) => console.log(`  ${r.code} | ${r.name}`));
  }
  if (onlyInDb.length) {
    console.log('\n--- Só no banco (primeiros 15) ---');
    onlyInDb.slice(0, 15).forEach((p) => console.log(`  ${p.internalCode} | ${p.name}`));
  }
  if (nameMismatch.length) {
    console.log('\n--- Nome diferente (primeiros 10) ---');
    nameMismatch.slice(0, 10).forEach((m) => {
      console.log(`  ${m.code}`);
      console.log(`    Planilha: ${m.sheet}`);
      console.log(`    Banco:    ${m.db}`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
