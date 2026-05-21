import { prisma } from '../../database/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import { applyActiveFilter } from '../../shared/utils/activeFilter';
import { z } from 'zod';
import { createSupplierSchema, updateSupplierSchema } from './suppliers.dto';

type CreateDTO = z.infer<typeof createSupplierSchema>;
type UpdateDTO = z.infer<typeof updateSupplierSchema>;

export class SupplierService {
  static async list(filters: Record<string, string | undefined>) {
    const where = {
      ...applyActiveFilter(filters.includeInactive),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { cnpj: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    return prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  static async findById(id: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundError('Fornecedor não encontrado');
    return supplier;
  }

  static async create(data: CreateDTO) {
    return prisma.supplier.create({
      data: {
        name: data.name,
        cnpj: data.cnpj || null,
        email: data.email || null,
        phone: data.phone,
        address: data.address,
      },
    });
  }

  static async update(id: string, data: UpdateDTO) {
    await this.findById(id);
    return prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.cnpj !== undefined && { cnpj: data.cnpj || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
  }

  static async deactivate(id: string) {
    await this.findById(id);
    await prisma.supplier.update({ where: { id }, data: { active: false } });
    return { message: 'Fornecedor desativado' };
  }
}
