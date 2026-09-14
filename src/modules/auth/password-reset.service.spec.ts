import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PasswordResetService } from './password-reset.service';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    authSession: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
  };

  const mockMailService: any = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfig: any = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        PASSWORD_RESET_TOKEN_TTL_MINUTES: '60',
        PASSWORD_RESET_TOKEN_BYTES: '32',
        PASSWORD_RESET_MAX_REQUESTS_PER_HOUR: '3',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return values[key] ?? defaultValue;
    }),
  };

  const activeUser = {
    id: 'user-1',
    email: 'owner@dotskills.com',
    fullName: 'Owner Name',
    status: 'ACTIVE',
    deletedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((operations: unknown[]) =>
      Promise.all(operations),
    );
    mockPrisma.passwordResetToken.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(PasswordResetService);
  });

  describe('requestReset', () => {
    it('sends a reset email and returns the generic response for a known active user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      const result = await service.requestReset(
        { email: activeUser.email },
        { ipAddress: '127.0.0.1' },
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      expect(mockMailService.send).toHaveBeenCalledTimes(1);
      expect(mockMailService.send.mock.calls[0][0].to).toBe(activeUser.email);
    });

    it('returns the exact same generic response for an unknown email, without creating a token or sending mail', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(activeUser);
      const known = await service.requestReset(
        { email: activeUser.email },
        { ipAddress: '127.0.0.1' },
      );

      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const unknown = await service.requestReset(
        { email: 'nobody@dotskills.com' },
        { ipAddress: '127.0.0.1' },
      );

      expect(unknown).toEqual(known);
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledTimes(1); // only for the known user above
      expect(mockMailService.send).toHaveBeenCalledTimes(1);
    });

    it('invalidates any previously issued unused token for the user before creating a new one', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      await service.requestReset(
        { email: activeUser.email },
        { ipAddress: '127.0.0.1' },
      );

      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: activeUser.id, usedAt: null },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
    });

    it('silently rate-limits per email after the configured request count, without an error and without sending mail', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockPrisma.passwordResetToken.count.mockResolvedValue(3);

      const result = await service.requestReset(
        { email: activeUser.email },
        { ipAddress: '127.0.0.1' },
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mockMailService.send).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    const rawToken = 'a'.repeat(64);
    const validRecord = {
      id: 'reset-1',
      userId: activeUser.id,
      tokenHash: hashToken(rawToken),
      usedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60_000),
      user: activeUser,
    };

    it('resets the password, marks the token used, and revokes all sessions on the happy path', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validRecord);

      const result = await service.reset({
        email: activeUser.email,
        token: rawToken,
        password: 'a-new-strong-password',
        passwordConfirmation: 'a-new-strong-password',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: activeUser.id } }),
      );
      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validRecord.id },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: activeUser.id, revokedAt: null },
        }),
      );
      expect(mockMailService.send).toHaveBeenCalledTimes(1);
    });

    it('rejects an expired token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.reset({
          email: activeUser.email,
          token: rawToken,
          password: 'a-new-strong-password',
          passwordConfirmation: 'a-new-strong-password',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an already-used token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord,
        usedAt: new Date(),
      });

      await expect(
        service.reset({
          email: activeUser.email,
          token: rawToken,
          password: 'a-new-strong-password',
          passwordConfirmation: 'a-new-strong-password',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token that does not exist (wrong token)', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.reset({
          email: activeUser.email,
          token: 'b'.repeat(64),
          password: 'a-new-strong-password',
          passwordConfirmation: 'a-new-strong-password',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a token/email pair mismatch', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(validRecord);

      await expect(
        service.reset({
          email: 'someone-else@dotskills.com',
          token: rawToken,
          password: 'a-new-strong-password',
          passwordConfirmation: 'a-new-strong-password',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('reports valid for an unused, unexpired token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.validateToken('token')).resolves.toEqual({
        valid: true,
      });
    });

    it('reports invalid for an unknown token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.validateToken('token')).resolves.toEqual({
        valid: false,
      });
    });
  });
});
