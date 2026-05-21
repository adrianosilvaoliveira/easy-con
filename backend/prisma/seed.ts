import {
  PrismaClient,
  RoleName,
  PermissionAction,
  StockLocationType,
} from '@prisma/client';
import { hashPassword } from '../src/shared/utils/password';

const prisma = new PrismaClient();

const MODULES = [
  'dashboard',
  'products',
  'stock',
  'movements',
  'inventory',
  'reports',
  'batches',
  'users',
  'audit',
  'settings',
] as const;

const ACTIONS: PermissionAction[] = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'EXPORT',
];

const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  ADMINISTRADOR: [], // all access via middleware
  OPERACIONAL: [
    'dashboard:READ',
    'products:READ',
    'products:CREATE',
    'products:UPDATE',
    'stock:READ',
    'stock:CREATE',
    'stock:UPDATE',
    'settings:READ',
    'settings:CREATE',
    'settings:UPDATE',
    'movements:READ',
    'movements:CREATE',
    'movements:APPROVE',
    'inventory:READ',
    'inventory:CREATE',
    'inventory:UPDATE',
    'reports:READ',
    'reports:EXPORT',
    'batches:READ',
    'batches:CREATE',
    'batches:UPDATE',
  ],
  FARMACIA: [
    'dashboard:READ',
    'products:READ', 'products:CREATE', 'products:UPDATE',
    'stock:READ',
    'movements:READ', 'movements:CREATE',
    'inventory:READ', 'inventory:CREATE', 'inventory:UPDATE',
    'reports:READ', 'reports:EXPORT',
    'batches:READ', 'batches:CREATE', 'batches:UPDATE',
  ],
  ESTOQUE: [
    'dashboard:READ',
    'products:READ', 'products:CREATE', 'products:UPDATE',
    'stock:READ',
    'movements:READ', 'movements:CREATE', 'movements:APPROVE',
    'inventory:READ', 'inventory:CREATE', 'inventory:UPDATE',
    'reports:READ', 'reports:EXPORT',
    'batches:READ', 'batches:CREATE', 'batches:UPDATE', 'batches:DELETE',
  ],
  AUDITOR: [
    'dashboard:READ',
    'products:READ',
    'stock:READ',
    'movements:READ',
    'inventory:READ',
    'reports:READ', 'reports:EXPORT',
    'batches:READ',
    'audit:READ',
  ],
  VISUALIZADOR: [
    'dashboard:READ',
    'products:READ',
    'stock:READ',
    'movements:READ',
    'inventory:READ',
    'reports:READ',
    'batches:READ',
  ],
};

async function main() {
  console.log('🌱 Seeding database...');

  // Permissions
  const permissions = [];
  for (const module of MODULES) {
    for (const action of ACTIONS) {
      const perm = await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: {
          module,
          action,
          description: `${action} em ${module}`,
        },
      });
      permissions.push(perm);
    }
  }

  // Roles
  const roleDescriptions: Record<RoleName, string> = {
    ADMINISTRADOR: 'Acesso total ao sistema',
    OPERACIONAL: 'Operação diária do estoque (entradas, saídas, cadastros, relatórios)',
    FARMACIA: 'Perfil legado — use Operacional',
    ESTOQUE: 'Perfil legado — use Operacional',
    AUDITOR: 'Auditoria e relatórios (somente leitura)',
    VISUALIZADOR: 'Somente visualização',
  };

  for (const roleName of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: roleDescriptions[roleName] },
      create: { name: roleName, description: roleDescriptions[roleName] },
    });

    if (roleName !== 'ADMINISTRADOR') {
      const perms = ROLE_PERMISSIONS[roleName];
      for (const permKey of perms) {
        const [module, action] = permKey.split(':');
        const permission = permissions.find(
          (p) => p.module === module && p.action === (action as PermissionAction)
        );
        if (permission) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId: role.id, permissionId: permission.id },
            },
            update: {},
            create: { roleId: role.id, permissionId: permission.id },
          });
        }
      }
    }
  }

  // Admin user
  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMINISTRADOR' },
  });

  await prisma.user.upsert({
    where: { email: 'admin@hospital.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@hospital.com',
      password: await hashPassword('Admin@123'),
      roleId: adminRole!.id,
      active: true,
    },
  });

  const operacionalRole = await prisma.role.findUnique({
    where: { name: 'OPERACIONAL' },
  });

  await prisma.user.upsert({
    where: { email: 'operacional@hospital.com' },
    update: {},
    create: {
      name: 'Operacional',
      email: 'operacional@hospital.com',
      password: await hashPassword('Oper@123'),
      roleId: operacionalRole!.id,
      active: true,
    },
  });

  // Stock locations
  const locations = [
    { name: 'Estoque Central', code: 'CENTRAL', type: StockLocationType.CENTRAL },
    { name: 'Centro Cirúrgico', code: 'CC', type: StockLocationType.CENTRO_CIRURGICO },
    { name: 'Consultório 1', code: 'CONS01', type: StockLocationType.CONSULTORIO },
    { name: 'Farmácia', code: 'FARM', type: StockLocationType.FARMACIA },
    { name: 'Satélite UTI', code: 'SAT01', type: StockLocationType.SATELITE },
  ];

  for (const loc of locations) {
    await prisma.stockLocation.upsert({
      where: { code: loc.code },
      update: {},
      create: loc,
    });
  }

  // Categories
  const categories = [
    'Medicamentos',
    'Materiais Cirúrgicos',
    'Lentes e Óptica',
    'Descartáveis',
    'Equipamentos',
    'Soluções Oftálmicas',
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Suppliers
  const suppliers = [
    { name: 'Distribuidora Oftalmica Ltda', cnpj: '12.345.678/0001-90' },
    { name: 'MedSupply Brasil', cnpj: '98.765.432/0001-10' },
    { name: 'OptiCare Distribuição', cnpj: '11.222.333/0001-44' },
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { cnpj: s.cnpj },
      update: {},
      create: s,
    });
  }

  // Sample products
  const catMed = await prisma.category.findUnique({ where: { name: 'Medicamentos' } });
  const catLentes = await prisma.category.findUnique({ where: { name: 'Lentes e Óptica' } });
  const central = await prisma.stockLocation.findUnique({ where: { code: 'CENTRAL' } });

  const products = [
    {
      name: 'Colírio Lubrificante 10ml',
      internalCode: 'COL-001',
      barcode: '7891001001001',
      categoryId: catMed!.id,
      manufacturer: 'Allergan',
      unit: 'UN',
      minQuantity: 50,
    },
    {
      name: 'Lente Intraocular Monofocal',
      internalCode: 'LIO-001',
      barcode: '7891001002002',
      categoryId: catLentes!.id,
      manufacturer: 'Alcon',
      unit: 'UN',
      minQuantity: 20,
    },
    {
      name: 'Seringa Descartável 5ml',
      internalCode: 'SER-005',
      barcode: '7891001003003',
      categoryId: catMed!.id,
      manufacturer: 'BD',
      unit: 'CX',
      minQuantity: 100,
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { internalCode: p.internalCode },
      update: {},
      create: p,
    });

    const batchNumber = `LOTE-${p.internalCode}-001`;
    const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const batch = await prisma.productBatch.upsert({
      where: {
        productId_stockLocationId_batchNumber: {
          productId: product.id,
          stockLocationId: central!.id,
          batchNumber,
        },
      },
      update: { quantity: 100, status: 'VALID' },
      create: {
        productId: product.id,
        stockLocationId: central!.id,
        batchNumber,
        expirationDate,
        manufacturingDate: new Date(),
        quantity: 100,
        status: 'VALID',
      },
    });

    await prisma.stockItem.upsert({
      where: {
        productId_locationId_batchId: {
          productId: product.id,
          locationId: central!.id,
          batchId: batch.id,
        },
      },
      update: { quantity: 100 },
      create: {
        productId: product.id,
        locationId: central!.id,
        batchId: batch.id,
        quantity: 100,
      },
    });
  }

  console.log('✅ Seed completed!');
  console.log('📧 Admin: admin@hospital.com / Admin@123');
  console.log('📧 Operacional: operacional@hospital.com / Oper@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
