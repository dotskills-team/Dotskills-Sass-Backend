import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

const LOGO_CONTENT_TYPE_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/** Fixed, app-enforced singleton row id — never client-supplied, never anything else. */
const SETTINGS_ID = 1;

/**
 * Platform-wide branding (logo shown in the Super Admin / Platform Staff
 * shell's sidebar+navbar) — a genuine singleton, mirroring exactly how
 * `CompanySettingsService.uploadLogo()` handles a company's own logo, just
 * without a companyId scope.
 */
@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async get() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    return {
      success: true,
      data: {
        logoUrl: settings?.logoUrl ?? null,
        updatedAt: settings?.updatedAt ?? null,
      },
    };
  }

  async uploadLogo(file: Express.Multer.File, actor: AuthenticatedUser) {
    const extension = LOGO_CONTENT_TYPE_EXTENSION[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Logo must be a PNG or JPEG image');
    }

    const before = await this.prisma.platformSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    const previousLogoUrl = before?.logoUrl ?? null;

    const key = `platform-settings/logo/${randomUUID()}.${extension}`;
    const logoUrl = await this.storageService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.platformSettings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, logoUrl, updatedByUserId: actor.userId },
        update: { logoUrl, updatedByUserId: actor.userId },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: actor.platformMemberId
            ? 'PLATFORM_MEMBER'
            : 'COMPANY_MEMBER',
          action: 'PLATFORM_LOGO_UPDATED',
          entityType: 'PlatformSettings',
          beforeData: { logoUrl: previousLogoUrl },
          afterData: { logoUrl },
        },
      });

      return settings;
    });

    if (previousLogoUrl) {
      const previousKey = this.extractKeyFromUrl(previousLogoUrl);
      if (previousKey) await this.storageService.deleteFile(previousKey);
    }

    return {
      success: true,
      data: {
        logoUrl: updated.logoUrl,
        updatedAt: updated.updatedAt,
      },
    };
  }

  private extractKeyFromUrl(url: string): string | null {
    const marker = 'platform-settings/';
    const index = url.indexOf(marker);
    return index === -1 ? null : url.slice(index);
  }
}
