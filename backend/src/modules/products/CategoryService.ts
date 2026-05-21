import { prisma } from '../../database/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { applyActiveFilter } from '../../shared/utils/activeFilter';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(2).max(100),
});

const updateCategorySchema = categorySchema.partial().extend({
  active: z.boolean().optional(),
});

export class CategoryService {
  static async list(filters: Record<string, string | undefined> = {}) {
    return prisma.category.findMany({
      where: {
        ...applyActiveFilter(filters.includeInactive),
        ...(filters.search && {
          name: { contains: filters.search, mode: 'insensitive' },
        }),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  static async findById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundError('Categoria não encontrada');
    return category;
  }

  static async create(data: z.infer<typeof categorySchema>) {
    return prisma.category.create({ data });
  }

  static async update(id: string, data: z.infer<typeof updateCategorySchema>) {
    await this.findById(id);
    return prisma.category.update({ where: { id }, data });
  }

  static async deactivate(id: string) {
    await this.findById(id);
    await prisma.category.update({ where: { id }, data: { active: false } });
    return { message: 'Categoria desativada' };
  }

  static async getDeleteCheck(id: string) {
    await this.findById(id);

    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    const reasons: string[] = [];

    if (productsCount > 0) {
      reasons.push(
        `Há ${productsCount} produto(s) vinculado(s) a esta categoria. Altere a categoria dos produtos ou remova-os antes de excluir.`
      );
    }

    return {
      canDelete: reasons.length === 0,
      reasons,
      counts: { products: productsCount },
    };
  }

  static async delete(id: string) {
    const check = await this.getDeleteCheck(id);
    if (!check.canDelete) {
      throw new ValidationError(
        check.reasons.length === 1
          ? check.reasons[0]
          : `Não é possível excluir esta categoria: ${check.reasons.join(' ')}`
      );
    }

    await prisma.category.delete({ where: { id } });
    return { message: 'Categoria excluída permanentemente' };
  }
}
