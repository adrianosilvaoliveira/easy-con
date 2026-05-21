import { prisma } from '../../database/prisma';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { Prisma } from '@prisma/client';

export class AlertService {
  static async list(filters: {
    page?: string;
    limit?: string;
    visualized?: string;
  }) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where: Prisma.ExpirationAlertWhereInput = {};
    if (filters.visualized === 'false') where.visualized = false;
    if (filters.visualized === 'true') where.visualized = true;

    const [data, total] = await Promise.all([
      prisma.expirationAlert.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { alertDate: 'desc' },
        include: {
          batch: {
            include: {
              product: { select: { id: true, name: true, internalCode: true } },
              stockLocation: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      prisma.expirationAlert.count({ where }),
    ]);

    return buildPaginatedResult(data, total, pagination);
  }

  static async countUnvisualized() {
    return prisma.expirationAlert.count({ where: { visualized: false } });
  }

  static async markVisualized(id: string) {
    return prisma.expirationAlert.update({
      where: { id },
      data: { visualized: true },
    });
  }

  static async markAllVisualized() {
    const result = await prisma.expirationAlert.updateMany({
      where: { visualized: false },
      data: { visualized: true },
    });
    return { updated: result.count };
  }
}
