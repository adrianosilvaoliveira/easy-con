import { prisma } from '../../database/prisma';
import { env } from '../../configs/env';
import type { UpdateOrganizationDto } from './organization.dto';

const SETTINGS_ID = 'default';

export class OrganizationService {
  static async get() {
    const existing = await prisma.organizationSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (existing) return existing;

    return prisma.organizationSettings.create({
      data: {
        id: SETTINGS_ID,
        name: env.HOSPITAL_NAME,
        cnpj: env.HOSPITAL_CNPJ || null,
        address: env.HOSPITAL_ADDRESS || null,
      },
    });
  }

  static async update(data: UpdateOrganizationDto) {
    const payload = {
      name: data.name,
      cnpj: data.cnpj?.trim() || null,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
    };

    return prisma.organizationSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...payload },
      update: payload,
    });
  }
}
