import { prisma } from '../database/prisma';
import { Prisma } from '@prisma/client';
import { parsePagination, buildPaginatedResult } from '../shared/utils/pagination';

interface AuditLogInput {
  userId?: string;
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async log(input: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        module: input.module,
        entityId: input.entityId,
        entityType: input.entityType,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  static async list(filters: {
    page?: string;
    limit?: string;
    module?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.module) where.module = filters.module;
    if (filters.userId) where.userId = filters.userId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }
    if (filters.search) {
      where.OR = [
        { action: { contains: filters.search, mode: 'insensitive' } },
        { module: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResult(data, total, pagination);
  }
}
