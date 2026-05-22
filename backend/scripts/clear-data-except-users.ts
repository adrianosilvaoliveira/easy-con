/**
 * Remove todos os registros operacionais, mantendo usuários e RBAC.
 * Uso: npm run prisma:clear-data -- --yes
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const confirmed =
  process.argv.includes('--yes') || process.env.CLEAR_DATA_YES === '1';

async function main() {
  if (!confirmed) {
    console.error(
      'Confirme com --yes ou CLEAR_DATA_YES=1 para executar (operação irreversível).'
    );
    process.exit(1);
  }

  console.log('🧹 Limpando dados (mantendo usuários, perfis e permissões)...');

  const run = async () => {
    const expirationAlerts = await prisma.expirationAlert.deleteMany();
    const stockMovements = await prisma.stockMovement.deleteMany();
    const inventoryItems = await prisma.inventoryItem.deleteMany();
    const inventories = await prisma.inventory.deleteMany();
    const stockItems = await prisma.stockItem.deleteMany();
    const productBatches = await prisma.productBatch.deleteMany();
    const products = await prisma.product.deleteMany();
    const categories = await prisma.category.deleteMany();
    const suppliers = await prisma.supplier.deleteMany();
    const stockLocations = await prisma.stockLocation.deleteMany();
    const auditLogs = await prisma.auditLog.deleteMany();
    const refreshTokens = await prisma.refreshToken.deleteMany();
    const passwordResets = await prisma.passwordReset.deleteMany();
    const organizationSettings = await prisma.organizationSettings.deleteMany();
    const users = await prisma.user.count();

    return {
      expirationAlerts,
      stockMovements,
      inventoryItems,
      inventories,
      stockItems,
      productBatches,
      products,
      categories,
      suppliers,
      stockLocations,
      auditLogs,
      refreshTokens,
      passwordResets,
      organizationSettings,
      users,
    };
  };

  let counts;
  try {
    counts = await prisma.$transaction(run, { maxWait: 60_000, timeout: 120_000 });
  } catch {
    console.warn('⚠️ Transação longa falhou; executando exclusões em sequência...');
    counts = await run();
  }

  console.log('✅ Limpeza concluída:');
  console.log(`   Alertas vencimento: ${counts.expirationAlerts.count}`);
  console.log(`   Movimentações: ${counts.stockMovements.count}`);
  console.log(`   Itens inventário: ${counts.inventoryItems.count}`);
  console.log(`   Inventários: ${counts.inventories.count}`);
  console.log(`   Itens estoque: ${counts.stockItems.count}`);
  console.log(`   Lotes: ${counts.productBatches.count}`);
  console.log(`   Produtos: ${counts.products.count}`);
  console.log(`   Categorias: ${counts.categories.count}`);
  console.log(`   Fornecedores: ${counts.suppliers.count}`);
  console.log(`   Locais estoque: ${counts.stockLocations.count}`);
  console.log(`   Auditoria: ${counts.auditLogs.count}`);
  console.log(`   Refresh tokens: ${counts.refreshTokens.count}`);
  console.log(`   Reset senha: ${counts.passwordResets.count}`);
  console.log(`   Config organização: ${counts.organizationSettings.count}`);
  console.log(`   Usuários preservados: ${counts.users}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
