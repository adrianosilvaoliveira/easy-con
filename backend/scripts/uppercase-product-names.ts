/**
 * Converte todos os nomes de produtos para maiúsculas.
 * Uso: npm run prisma:uppercase-products -- --yes
 */
import { PrismaClient } from '@prisma/client';
import { normalizeProductName } from '../src/shared/utils/productName';

const prisma = new PrismaClient();

async function main() {
  const dryRun = !process.argv.includes('--yes');
  const products = await prisma.product.findMany({ select: { id: true, name: true } });

  let updated = 0;
  for (const product of products) {
    const normalized = normalizeProductName(product.name);
    if (normalized === product.name) continue;
    updated++;
    if (dryRun) {
      console.log(`  ${product.name} → ${normalized}`);
    } else {
      await prisma.product.update({
        where: { id: product.id },
        data: { name: normalized },
      });
    }
  }

  if (dryRun) {
    console.log(`\n${updated} produto(s) seriam atualizados. Rode com --yes para aplicar.`);
  } else {
    console.log(`✅ ${updated} produto(s) atualizado(s) para maiúsculas.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
