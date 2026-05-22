/**
 * Importa produtos do Contrato.pdf (via contrato-products.json) para o banco.
 * Uso:
 *   npx tsx scripts/parse-contrato-pdf.ts
 *   npx tsx scripts/import-contrato-products.ts --yes
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { calculateExpirationStatus } from '../src/shared/utils/expiration';
import type { ContratoProductRow } from './parse-contrato-pdf';

const prisma = new PrismaClient();

const CATEGORIES = [
  'Medicamentos',
  'Materiais Cirúrgicos',
  'Lentes e Óptica',
  'Descartáveis',
  'Equipamentos',
  'Soluções Oftálmicas',
] as const;

function inferCategory(name: string): (typeof CATEGORIES)[number] {
  const n = name.toLowerCase();
  if (
    /colirio|lente de contato|fluorescein|bss|balanced salt|metilcelulose|perfluor|avastin|vabysmo|eylia|ozurdex|oftalm|viscoelast|mydriacyl|vigamox|vigadexa|atropina|pilocan|opht-|azul de trypan|dimetilpolisiloxane|hipertonic.*colirio/.test(
      n
    )
  ) {
    return 'Soluções Oftálmicas';
  }
  if (/lente|monarch|anel de tensao|oclusor acrilico|cartucho/.test(n)) {
    return 'Lentes e Óptica';
  }
  if (
    /bisturi|fio |lamina de bisturi|campo cirurgic|campo de mesa|campo para mesa|luva cir|retrator|tubo endotraqueal|papel grau cirurgico|fio seda|fio nylon|fio acido|fio polipropileno/.test(
      n
    )
  ) {
    return 'Materiais Cirúrgicos';
  }
  if (
    /cloridrato| mg\/ml| mg |ampola|comprimido|soro |dipirona|ceftriaxona|midazolam|diazepam|gentamicina|fenobarbital|glicose|manitol|fentanila|dobutamina|vancomicina|prometazina|hidrocortisona|adrenalina|norepinefrina|fenitoina|amiodarona|ropivacaina|lidocaina|paracetamol|tenoxican|furosemida|haloperidol|ondacetrona|fenilefrina/.test(
      n
    )
  ) {
    return 'Medicamentos';
  }
  if (
    /seringa|agulha|mascara|touca|prop[eé]|avental|luva.*procedimento|lanceta|compressa|cateter|equipo|fita micropor|esparadrapo|algodao|alcool|clorexidina|pvpi|detergente|torneira|integrador|papel grau|eletrodos|campo ciurgico desc|indicador biologico|almotolia|biológico/.test(
      n
    )
  ) {
    return 'Descartáveis';
  }
  return 'Equipamentos';
}

async function ensureBaseData() {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const locations = [
    { name: 'Estoque Central', code: 'CENTRAL', type: 'CENTRAL' as const },
    { name: 'Centro Cirúrgico', code: 'CC', type: 'CENTRO_CIRURGICO' as const },
    { name: 'Consultório 1', code: 'CONS01', type: 'CONSULTORIO' as const },
    { name: 'Farmácia', code: 'FARM', type: 'FARMACIA' as const },
    { name: 'Satélite UTI', code: 'SAT01', type: 'SATELITE' as const },
  ];

  for (const loc of locations) {
    await prisma.stockLocation.upsert({
      where: { code: loc.code },
      update: {},
      create: loc,
    });
  }

  await prisma.organizationSettings.upsert({
    where: { id: 'default' },
    update: {
      name: 'Centro de Diagnóstico Oftalmológico Monticuco',
      cnpj: '34.515.073/0001-38',
    },
    create: {
      id: 'default',
      name: 'Centro de Diagnóstico Oftalmológico Monticuco',
      cnpj: '34.515.073/0001-38',
    },
  });
}

async function main() {
  const confirmed = process.argv.includes('--yes') || process.env.IMPORT_CONTRATO_YES === '1';
  if (!confirmed) {
    console.error('Confirme com --yes ou IMPORT_CONTRATO_YES=1');
    process.exit(1);
  }

  const dataPath = path.join(__dirname, 'data', 'contrato-products.json');
  if (!fs.existsSync(dataPath)) {
    console.error('Arquivo não encontrado. Rode: npx tsx scripts/parse-contrato-pdf.ts');
    process.exit(1);
  }

  const rows = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as ContratoProductRow[];
  console.log(`📦 Importando ${rows.length} produtos do contrato...`);

  await ensureBaseData();

  const categoryMap = new Map(
    (await prisma.category.findMany()).map((c) => [c.name, c.id])
  );
  const central = await prisma.stockLocation.findUnique({ where: { code: 'CENTRAL' } });
  if (!central) throw new Error('Local CENTRAL não encontrado');

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@hospital.com' },
  });

  const existingCodes = new Set(
    (await prisma.product.findMany({ select: { internalCode: true } })).map((p) => p.internalCode)
  );

  let created = 0;
  let updated = 0;
  let withStock = 0;

  const defaultExpiry = new Date();
  defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);

  const BATCH = 15;
  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const chunk = rows.slice(offset, offset + BATCH);
    await prisma.$transaction(
      async (tx) => {
        for (const row of chunk) {
          const categoryName = inferCategory(row.name);
          const categoryId = categoryMap.get(categoryName)!;
          const internalCode = row.code;
          const manufacturer = row.brand || undefined;
          const minQuantity = Math.max(0, Math.floor(row.stock * 0.1));
          const isNew = !existingCodes.has(internalCode);

          const product = await tx.product.upsert({
            where: { internalCode },
            update: {
              name: row.name,
              manufacturer,
              categoryId,
              unit: 'UN',
              minQuantity,
              active: true,
              notes: 'Importado do Contrato.pdf (CDO Monticuco)',
            },
            create: {
              name: row.name,
              internalCode,
              categoryId,
              manufacturer,
              unit: 'UN',
              minQuantity,
              active: true,
              notes: 'Importado do Contrato.pdf (CDO Monticuco)',
            },
          });

          if (isNew) {
            created++;
            existingCodes.add(internalCode);
          } else updated++;

          if (row.stock > 0) {
            const batchNumber = `CTR-${internalCode}`;
            const status = calculateExpirationStatus(defaultExpiry);

            const batch = await tx.productBatch.upsert({
              where: {
                productId_stockLocationId_batchNumber: {
                  productId: product.id,
                  stockLocationId: central.id,
                  batchNumber,
                },
              },
              update: { quantity: row.stock, status },
              create: {
                productId: product.id,
                stockLocationId: central.id,
                batchNumber,
                expirationDate: defaultExpiry,
                manufacturingDate: new Date(),
                quantity: row.stock,
                status,
                createdById: admin?.id,
              },
            });

            await tx.stockItem.upsert({
              where: {
                productId_locationId_batchId: {
                  productId: product.id,
                  locationId: central.id,
                  batchId: batch.id,
                },
              },
              update: { quantity: row.stock },
              create: {
                productId: product.id,
                locationId: central.id,
                batchId: batch.id,
                quantity: row.stock,
              },
            });
            withStock++;
          }
        }
      },
      { timeout: 120_000, maxWait: 30_000 }
    );
    process.stdout.write(`\r   ${Math.min(offset + BATCH, rows.length)}/${rows.length}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log('');

  console.log('✅ Importação concluída');
  console.log(`   Novos: ${created} | Atualizados: ${updated}`);
  console.log(`   Com estoque inicial: ${withStock}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
