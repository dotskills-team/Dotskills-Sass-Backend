import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';

const AVATAR_CONTENT_TYPE_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

@Injectable()
export class UserProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Fresh DB read scoped by actor.userId — mirrors the Company.logoUrl
   * precedent: mutable profile data is never embedded in the JWT, always
   * refetched, so it can never go stale between login and now.
   */
  async getProfile(actor: AuthenticatedUser) {
    const user = await this.requireUser(actor.userId);
    return {
      success: true,
      data: {
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      },
    };
  }

  /**
   * Same server-side mimetype gate as Company Logo's uploadLogo (defense
   * in depth on top of the controller's ParseFilePipeBuilder). The old
   * avatar (if any) is deleted from storage only after the DB write
   * commits, so a failed delete never blocks the new avatar from taking
   * effect.
   */
  async uploadProfileImage(actor: AuthenticatedUser, file: Express.Multer.File) {
    const extension = AVATAR_CONTENT_TYPE_EXTENSION[file.mimetype];
    if (!extension) {
      throw new BadRequestException('Profile image must be a PNG or JPEG image');
    }

    const before = await this.requireUser(actor.userId);
    const previousImageUrl = before.profileImageUrl;

    const key = `user-avatars/${actor.userId}/${randomUUID()}.${extension}`;
    const profileImageUrl = await this.storageService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: actor.userId },
        data: { profileImageUrl },
        select: { id: true, fullName: true, email: true, profileImageUrl: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: actor.platformMemberId ? 'PLATFORM_MEMBER' : 'COMPANY_MEMBER',
          action: 'USER_PROFILE_IMAGE_UPDATED',
          entityType: 'User',
          entityId: actor.userId,
          beforeData: { profileImageUrl: previousImageUrl },
          afterData: { profileImageUrl },
        },
      });
      return user;
    });

    if (previousImageUrl) {
      const previousKey = this.extractKeyFromUrl(previousImageUrl);
      if (previousKey) await this.storageService.deleteFile(previousKey);
    }

    return {
      success: true,
      data: {
        userId: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        profileImageUrl: updated.profileImageUrl,
      },
    };
  }

  /**
   * Current-password verification is mandatory and always re-reads the
   * hash fresh from the DB by actor.userId — never trusts the session
   * alone. On success, every OTHER active AuthSession for this user is
   * revoked (best-effort, after the transaction commits) — the current
   * session (actor.sessionId) is deliberately excluded so the user isn't
   * logged out mid-flow. Matches GitHub/Google-style "log out everywhere
   * else, stay logged in here."
   */
  async changePassword(actor: AuthenticatedUser, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException('User was not found');

    const currentPasswordIsValid = user.passwordHash
      ? await verifyPassword(user.passwordHash, dto.currentPassword)
      : false;
    if (!currentPasswordIsValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.userId },
        data: { passwordHash: newPasswordHash, passwordChangedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.userId,
          actorType: actor.platformMemberId ? 'PLATFORM_MEMBER' : 'COMPANY_MEMBER',
          action: 'USER_PASSWORD_CHANGED',
          entityType: 'User',
          entityId: actor.userId,
        },
      });
    });

    const revoked = await this.prisma.authSession.updateMany({
      where: {
        userId: actor.userId,
        id: { not: actor.sessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGED' },
    });

    return {
      success: true,
      message: 'Password changed successfully',
      otherSessionsRevoked: revoked.count,
    };
  }

  private extractKeyFromUrl(url: string): string | null {
    const marker = 'user-avatars/';
    const index = url.indexOf(marker);
    return index === -1 ? null : url.slice(index);
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, profileImageUrl: true },
    });
    if (!user) throw new NotFoundException('User was not found');
    return user;
  }
}
