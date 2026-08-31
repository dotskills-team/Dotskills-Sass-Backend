import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CompanyContext } from '../../../common/types/company-context.type';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import { UpdateCompanySettingsDto } from './dto/company-settings.dto';

const SETTINGS_SELECT = {
  id: true,
  enableMultiUnit: true,
  enableCustomerDue: true,
  enableBarcode: true,
  enableProductVariant: true,
  enableComboOffer: true,
  enableMultiLocation: true,
  allowNegativeStock: true,
  maxCustomerDueLimit: true,
  enableTax: true,
  defaultTaxRate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySettingsSelect;

@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(context: CompanyContext) {
    const settings = await this.requireSettings(context);
    return { success: true, data: settings };
  }

  /**
   * The row always exists (created in the same transaction as the Company
   * itself, see CompanyManagementService.create()) — there is deliberately
   * no create endpoint here, only read + update.
   */
  async update(
    context: CompanyContext,
    dto: UpdateCompanySettingsDto,
    actor: AuthenticatedUser,
  ) {
    const before = await this.requireSettings(context);

    const settings = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.companySettings.update({
        where: { companyId: context.companyId },
        data: {
          ...(dto.enableMultiUnit !== undefined
            ? { enableMultiUnit: dto.enableMultiUnit }
            : {}),
          ...(dto.enableCustomerDue !== undefined
            ? { enableCustomerDue: dto.enableCustomerDue }
            : {}),
          ...(dto.enableBarcode !== undefined
            ? { enableBarcode: dto.enableBarcode }
            : {}),
          ...(dto.enableProductVariant !== undefined
            ? { enableProductVariant: dto.enableProductVariant }
            : {}),
          ...(dto.enableComboOffer !== undefined
            ? { enableComboOffer: dto.enableComboOffer }
            : {}),
          ...(dto.enableMultiLocation !== undefined
            ? { enableMultiLocation: dto.enableMultiLocation }
            : {}),
          ...(dto.allowNegativeStock !== undefined
            ? { allowNegativeStock: dto.allowNegativeStock }
            : {}),
          ...(dto.maxCustomerDueLimit !== undefined
            ? { maxCustomerDueLimit: dto.maxCustomerDueLimit }
            : {}),
          ...(dto.enableTax !== undefined ? { enableTax: dto.enableTax } : {}),
          ...(dto.defaultTaxRate !== undefined
            ? { defaultTaxRate: dto.defaultTaxRate }
            : {}),
        },
        select: SETTINGS_SELECT,
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          actorUserId: actor.userId,
          actorType: 'COMPANY_MEMBER',
          action: 'COMPANY_SETTINGS_UPDATED',
          entityType: 'CompanySettings',
          entityId: updated.id,
          beforeData: before,
          afterData: updated,
        },
      });
      return updated;
    });

    return { success: true, data: settings };
  }

  private async requireSettings(context: CompanyContext) {
    const settings = await this.prisma.companySettings.findFirst({
      where: { tenantId: context.tenantId, companyId: context.companyId },
      select: SETTINGS_SELECT,
    });
    if (!settings)
      throw new NotFoundException('Company settings were not found');
    return settings;
  }
}
