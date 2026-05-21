"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const password_1 = require("../src/shared/utils/password");
const prisma = new client_1.PrismaClient();
const MODULES = [
    'dashboard',
    'products',
    'stock',
    'movements',
    'inventory',
    'reports',
    'users',
    'audit',
    'settings',
];
const ACTIONS = [
    'CREATE',
    'READ',
    'UPDATE',
    'DELETE',
    'APPROVE',
    'EXPORT',
];
const ROLE_PERMISSIONS = {
    ADMINISTRADOR: [], // all access via middleware
    FARMACIA: [
        'dashboard:READ',
        'products:READ', 'products:CREATE', 'products:UPDATE',
        'stock:READ',
        'movements:READ', 'movements:CREATE',
        'inventory:READ', 'inventory:CREATE', 'inventory:UPDATE',
        'reports:READ', 'reports:EXPORT',
    ],
    ESTOQUE: [
        'dashboard:READ',
        'products:READ', 'products:CREATE', 'products:UPDATE',
        'stock:READ',
        'movements:READ', 'movements:CREATE', 'movements:APPROVE',
        'inventory:READ', 'inventory:CREATE', 'inventory:UPDATE',
        'reports:READ', 'reports:EXPORT',
    ],
    AUDITOR: [
        'dashboard:READ',
        'products:READ',
        'stock:READ',
        'movements:READ',
        'inventory:READ',
        'reports:READ', 'reports:EXPORT',
        'audit:READ',
    ],
    VISUALIZADOR: [
        'dashboard:READ',
        'products:READ',
        'stock:READ',
        'movements:READ',
        'inventory:READ',
        'reports:READ',
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
    const roleDescriptions = {
        ADMINISTRADOR: 'Acesso total ao sistema',
        FARMACIA: 'Gestão farmacêutica e dispensação',
        ESTOQUE: 'Gestão de estoque e movimentações',
        AUDITOR: 'Auditoria e relatórios',
        VISUALIZADOR: 'Somente visualização',
    };
    for (const roleName of Object.values(client_1.RoleName)) {
        const role = await prisma.role.upsert({
            where: { name: roleName },
            update: { description: roleDescriptions[roleName] },
            create: { name: roleName, description: roleDescriptions[roleName] },
        });
        if (roleName !== 'ADMINISTRADOR') {
            const perms = ROLE_PERMISSIONS[roleName];
            for (const permKey of perms) {
                const [module, action] = permKey.split(':');
                const permission = permissions.find((p) => p.module === module && p.action === action);
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
            password: await (0, password_1.hashPassword)('Admin@123'),
            roleId: adminRole.id,
            active: true,
        },
    });
    // Stock locations
    const locations = [
        { name: 'Estoque Central', code: 'CENTRAL', type: client_1.StockLocationType.CENTRAL },
        { name: 'Centro Cirúrgico', code: 'CC', type: client_1.StockLocationType.CENTRO_CIRURGICO },
        { name: 'Consultório 1', code: 'CONS01', type: client_1.StockLocationType.CONSULTORIO },
        { name: 'Farmácia', code: 'FARM', type: client_1.StockLocationType.FARMACIA },
        { name: 'Satélite UTI', code: 'SAT01', type: client_1.StockLocationType.SATELITE },
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
            categoryId: catMed.id,
            manufacturer: 'Allergan',
            unit: 'UN',
            minQuantity: 50,
        },
        {
            name: 'Lente Intraocular Monofocal',
            internalCode: 'LIO-001',
            barcode: '7891001002002',
            categoryId: catLentes.id,
            manufacturer: 'Alcon',
            unit: 'UN',
            minQuantity: 20,
        },
        {
            name: 'Seringa Descartável 5ml',
            internalCode: 'SER-005',
            barcode: '7891001003003',
            categoryId: catMed.id,
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
        const batch = await prisma.productBatch.upsert({
            where: { productId_lot: { productId: product.id, lot: `LOTE-${p.internalCode}-001` } },
            update: {},
            create: {
                productId: product.id,
                lot: `LOTE-${p.internalCode}-001`,
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            },
        });
        await prisma.stockItem.upsert({
            where: {
                productId_locationId_batchId: {
                    productId: product.id,
                    locationId: central.id,
                    batchId: batch.id,
                },
            },
            update: { quantity: 100 },
            create: {
                productId: product.id,
                locationId: central.id,
                batchId: batch.id,
                quantity: 100,
            },
        });
    }
    console.log('✅ Seed completed!');
    console.log('📧 Admin: admin@hospital.com');
    console.log('🔑 Password: Admin@123');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map