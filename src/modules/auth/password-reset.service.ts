import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  passwordChangedEmailHtml,
  passwordResetEmailHtml,
} from '../mail/mail.templates';
import { hashPassword } from '../../common/utils/password.util';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { RequestMetadata } from './interfaces/jwt-payload.interface';

const GENERIC_RESULT = {
  success: true as const,
  message:
    'If an account exists for that email, a password reset link has been sent.',
};

const INVALID_TOKEN_MESSAGE =
  'This password reset link is invalid, expired, or has already been used.';

/** Log-safe identifiers — never the full address, never the token/password. */
function emailDomain(email: string): string {
  return email.split('@')[1] ?? 'unknown';
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local[0]}***@${domain}`;
}

/**
 * Deliberately separate from `AuthService` (single responsibility, and
 * keeps the already-large login/refresh/session logic untouched). Every
 * response shape and error path here is designed around one rule: neither
 * endpoint may ever reveal whether a given email is registered.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly tokenTtlMinutes: number;
  private readonly tokenBytes: number;
  private readonly maxRequestsPerWindow: number;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    configService: ConfigService,
  ) {
    this.tokenTtlMinutes = Number(
      configService.get<string>('PASSWORD_RESET_TOKEN_TTL_MINUTES', '60'),
    );
    this.tokenBytes = Number(
      configService.get<string>('PASSWORD_RESET_TOKEN_BYTES', '32'),
    );
    this.maxRequestsPerWindow = Number(
      configService.get<string>('PASSWORD_RESET_MAX_REQUESTS_PER_HOUR', '3'),
    );
    this.frontendUrl =
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async requestReset(dto: ForgotPasswordDto, metadata: RequestMetadata) {
    this.logger.log({
      event: 'forgot_password_requested',
      domain: emailDomain(dto.email),
    });

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE' || !user.email) {
      this.logger.log({
        event: 'forgot_password_user_not_eligible',
        domain: emailDomain(dto.email),
        found: !!user,
      });
      // No account (or an unusable one) to act on — still perform
      // comparable-cost work so response timing doesn't distinguish this
      // path from the real one (same decoy technique `AuthService.login`
      // already uses for invalid-credential timing).
      await hashPassword(randomBytes(32).toString('hex'));
      return GENERIC_RESULT;
    }

    const recentRequestCount = await this.prisma.passwordResetToken.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
      },
    });

    if (recentRequestCount >= this.maxRequestsPerWindow) {
      this.logger.log({
        event: 'forgot_password_rate_limited',
        domain: emailDomain(dto.email),
      });
      // Per-email throttling: silently drop the request rather than send
      // another email or reveal a rate-limit error — the caller still gets
      // the exact same generic response either way.
      return GENERIC_RESULT;
    }

    const token = randomBytes(this.tokenBytes).toString('hex');
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.tokenTtlMinutes * 60_000);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestIp: metadata.ipAddress,
        },
      }),
    ]);
    this.logger.log({
      event: 'forgot_password_token_created',
      domain: emailDomain(dto.email),
      expiresAt: expiresAt.toISOString(),
    });

    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    const { subject, html } = passwordResetEmailHtml({
      fullName: user.fullName,
      resetUrl,
      expiresInMinutes: this.tokenTtlMinutes,
    });
    this.logger.log({
      event: 'forgot_password_email_send_started',
      to: maskEmail(user.email),
      resetUrlStructure: `${this.frontendUrl}/reset-password?token=[REDACTED]&email=[REDACTED]`,
    });
    await this.mailService.send({ to: user.email, subject, html });

    return GENERIC_RESULT;
  }

  async validateToken(token: string): Promise<{ valid: boolean }> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: { expiresAt: true, usedAt: true },
    });

    const valid = !!record && !record.usedAt && record.expiresAt > new Date();
    return { valid };
  }

  async reset(dto: ResetPasswordDto) {
    const presentedHash = this.hashToken(dto.token);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: presentedHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!record || !this.hashesMatch(record.tokenHash, presentedHash)) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }

    if (
      record.usedAt ||
      record.expiresAt <= new Date() ||
      record.user.deletedAt ||
      record.user.status !== 'ACTIVE' ||
      record.user.email !== dto.email
    ) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }

    const newPasswordHash = await hashPassword(dto.password);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'PASSWORD_RESET' },
      }),
    ]);

    await this.mailService.send({
      to: record.user.email,
      ...passwordChangedEmailHtml({ fullName: record.user.fullName }),
    });

    return {
      success: true as const,
      message:
        'Your password has been reset. Please log in with your new password.',
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesMatch(stored: string, presented: string): boolean {
    const storedBuffer = Buffer.from(stored, 'hex');
    const presentedBuffer = Buffer.from(presented, 'hex');
    return (
      storedBuffer.length === presentedBuffer.length &&
      timingSafeEqual(storedBuffer, presentedBuffer)
    );
  }
}
