import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
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
  maxSupplierPayableLimit: true,
  enableTax: true,
  defaultTaxRate: true,
  createdAt: true,
  updatedAt: true,
  // logoUrl lives on Company (identity/branding, not a feature toggle) —
  // surfaced flattened onto the settings response below so the frontend
  // gets it in the same round-trip as every other settings field.
  company: { select: { logoUrl: true } },
} satisfies Prisma.CompanySettingsSelect;

const LOGO_CONTENT_TYPE_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

function flattenSettings<T extends { company: { logoUrl: string | null } }>(
  settings: T,
) {
  const { company, ...rest } = settings;
  return { ...rest, logoUrl: company.logoUrl };
}

@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async get(context: CompanyContext) {
    const settings = await this.requireSettings(context);
    return { success: true, data: flattenSettings(settings) };
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
          ...(dto.maxSupplierPayableLimit !== undefined
            ? { maxSupplierPayableLimit: dto.maxSupplierPayableLimit }
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

    return { success: true, data: flattenSettings(settings) };
  }

  /**
   * Uploads a new logo to cloud storage and replaces `Company.logoUrl`.
   * Server-side mimetype check here too (in addition to the controller's
   * ParseFilePipeBuilder gate) since this method is the actual business
   * rule, not just an HTTP-layer concern — never trust a single gate for
   * something client-supplied. The previous logo object (if any) is
   * deleted from storage after the DB write commits, so a failed delete
   * never blocks the new logo from taking effect; it only leaves a
   * harmless orphaned object for later cleanup.
   */
  async uploadLogo(
    context: CompanyContext,
    file: Express.Multer.File,
    actor: AuthenticatedUser,
  ) {
    const extension = LOGO_CONTENT_TYPE_EXTENSION[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Logo must be a PNG or JPEG image');
    }

    const before = await this.requireSettings(context);
    const previousLogoUrl = before.company.logoUrl;

    const key = `company-logos/${context.companyId}/${randomUUID()}.${extension}`;
    const logoUrl = await this.storageService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    const settings = await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: context.companyId },
        data: { logoUrl },
      });
      const updated = await tx.companySettings.findUniqueOrThrow({
        where: { companyId: context.companyId },
        select: SETTINGS_SELECT,
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          companyId: context.companyId,
          actorUserId: actor.userId,
          actorType: 'COMPANY_MEMBER',
          action: 'COMPANY_LOGO_UPDATED',
          entityType: 'Company',
          entityId: context.companyId,
          beforeData: { logoUrl: previousLogoUrl },
          afterData: { logoUrl },
        },
      });
      return updated;
    });

    if (previousLogoUrl) {
      const previousKey = this.extractKeyFromUrl(previousLogoUrl);
      if (previousKey) await this.storageService.deleteFile(previousKey);
    }

    return { success: true, data: flattenSettings(settings) };
  }

  private extractKeyFromUrl(url: string): string | null {
    const marker = 'company-logos/';
    const index = url.indexOf(marker);
    return index === -1 ? null : url.slice(index);
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
