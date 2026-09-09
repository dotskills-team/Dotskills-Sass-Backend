import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolvePermissionEffects } from '../../common/utils/resolve-permission-effects';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import type { Prisma } from '../../generated/phase-1-prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  RequestMetadata,
} from './interfaces/jwt-payload.interface';

type PlatformUser = Prisma.UserGetPayload<{
  include: {
    platformMember: {
      include: { roles: { include: { platformRole: true } } };
    };
    companyMemberships: {
      select: { id: true; status: true };
    };
  };
}>;

type PlatformRoleAssignment = {
  platformRole: { status: string; code: string };
};

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly maxFailedAttempts: number;
  private readonly lockMinutes: number;
  private readonly dummyHashPromise: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.issuer = configService.get<string>('JWT_ISSUER', 'dotskills-api');
    this.audience = configService.get<string>('JWT_AUDIENCE', 'dotskills-web');
    this.accessTtlSeconds = Number(
      configService.getOrThrow<string>('JWT_ACCESS_TTL_SECONDS'),
    );
    this.refreshTtlSeconds = Number(
      configService.getOrThrow<string>('JWT_REFRESH_TTL_SECONDS'),
    );
    this.maxFailedAttempts = Number(
      configService.getOrThrow<string>('AUTH_MAX_FAILED_ATTEMPTS'),
    );
    this.lockMinutes = Number(
      configService.getOrThrow<string>('AUTH_LOCK_MINUTES'),
    );
    this.dummyHashPromise = hashPassword(randomBytes(32).toString('hex'));
  }

  // async login(dto: LoginDto, metadata: RequestMetadata) {

  async login(dto: LoginDto, metadata: RequestMetadata) {
    return this.authenticate(dto, metadata, false);
  }

  async staffLogin(dto: LoginDto, metadata: RequestMetadata) {
    return this.authenticate(dto, metadata, true);
  }

  private async authenticate(
    dto: LoginDto,
    metadata: RequestMetadata,
    requirePlatformStaff: boolean,
  ) {
    const email = dto.email.trim().toLowerCase();
    let user = await this.findPlatformUserByEmail(email);
    const now = new Date();

    if (!user) {
      await verifyPassword(await this.dummyHashPromise, dto.password);
      await this.recordLoginEvent(
        null,
        email,
        false,
        'INVALID_CREDENTIALS',
        metadata,
      );
      throw this.invalidCredentials();
    }

    if (
      user.status === 'LOCKED' &&
      user.lockedUntil &&
      user.lockedUntil <= now
    ) {
      user = await this.unlockAndReloadUser(user.id, email);
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.recordLoginEvent(
        user.id,
        email,
        false,
        'ACCOUNT_LOCKED',
        metadata,
      );
      throw this.invalidCredentials();
    }

    if (user.status !== 'ACTIVE' || user.deletedAt) {
      await this.recordLoginEvent(
        user.id,
        email,
        false,
        'ACCOUNT_UNAVAILABLE',
        metadata,
      );
      throw this.invalidCredentials();
    }

    // const roles = this.activeRoleCodes(user);
    // if (!this.hasActiveMembership(user, roles)) {

    const roles = this.activeRoleCodes(user);

    const hasRequiredMembership = requirePlatformStaff
      ? this.hasActivePlatformMembership(user, roles)
      : this.hasActiveMembership(user, roles);

    if (!hasRequiredMembership) {
      await this.recordLoginEvent(
        user.id,
        email,
        false,
        'PLATFORM_ACCESS_DENIED',
        metadata,
      );
      throw this.invalidCredentials();
    }

    const passwordIsValid = user.passwordHash
      ? await verifyPassword(user.passwordHash, dto.password)
      : false;

    if (!passwordIsValid) {
      await this.registerFailedLogin(user, email, metadata);
      throw this.invalidCredentials();
    }

    const upgradedPasswordHash = user.passwordHash!.startsWith('$argon2')
      ? undefined
      : await hashPassword(dto.password);

    const sessionId = randomUUID();
    const tokens = await this.issueTokenPair(user.id, sessionId, roles);
    const refreshTokenHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(now.getTime() + this.refreshTtlSeconds * 1000);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: now,
          ...(upgradedPasswordHash
            ? { passwordHash: upgradedPasswordHash, passwordChangedAt: now }
            : {}),
        },
      }),
      this.prisma.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash,
          deviceId: dto.deviceId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          issuedAt: now,
          lastSeenAt: now,
          expiresAt,
        },
      }),
      this.prisma.loginEvent.create({
        data: {
          userId: user.id,
          email,
          success: true,
          reason: 'LOGIN_SUCCESS',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
    ]);

    // return {
    //   ...tokens,
    //   tokenType: "Bearer",
    //   accessTokenExpiresIn: this.accessTtlSeconds,
    //   refreshTokenExpiresIn: this.refreshTtlSeconds,
    //   user: this.toAuthenticatedUser(user, sessionId, roles),
    // };
    const authenticatedUser = this.toAuthenticatedUser(user, sessionId, roles);

    const permissions = requirePlatformStaff
      ? await this.effectivePlatformPermissions(user.id, roles)
      : undefined;

    return {
      ...tokens,
      tokenType: 'Bearer',
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshTokenExpiresIn: this.refreshTtlSeconds,
      user: requirePlatformStaff
        ? {
            ...authenticatedUser,
            userType: 'PLATFORM_STAFF' as const,
            permissions,
          }
        : authenticatedUser,
    };
  }

  async refresh(dto: RefreshTokenDto, metadata: RequestMetadata) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const presentedHash = this.hashToken(dto.refreshToken);

    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: presentedHash },
      include: {
        user: {
          include: {
            platformMember: {
              include: { roles: { include: { platformRole: true } } },
            },
            companyMemberships: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.id !== payload.sid ||
      session.userId !== payload.sub
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      if (session.replacedByHash) {
        await this.revokeAllSessions(session.userId, 'REFRESH_TOKEN_REUSE');
      }
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const now = new Date();
    if (session.expiresAt <= now) {
      await this.prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'EXPIRED' },
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = session.user;
    const roles = this.activeRoleCodes(user);
    if (
      user.deletedAt ||
      user.status !== 'ACTIVE' ||
      !this.hasActiveMembership(user, roles)
    ) {
      await this.revokeAllSessions(user.id, 'ACCOUNT_UNAVAILABLE');
      throw new UnauthorizedException('Account is unavailable');
    }

    const newSessionId = randomUUID();
    const tokens = await this.issueTokenPair(user.id, newSessionId, roles);
    const newRefreshHash = this.hashToken(tokens.refreshToken);
    const expiresAt = new Date(now.getTime() + this.refreshTtlSeconds * 1000);

    await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const revoked = await transaction.authSession.updateMany({
          where: {
            id: session.id,
            refreshTokenHash: presentedHash,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revokeReason: 'ROTATED',
            replacedByHash: newRefreshHash,
            lastSeenAt: now,
          },
        });

        if (revoked.count !== 1) {
          throw new UnauthorizedException('Refresh token was already used');
        }

        await transaction.authSession.create({
          data: {
            id: newSessionId,
            userId: user.id,
            refreshTokenHash: newRefreshHash,
            deviceId: dto.deviceId ?? session.deviceId,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            issuedAt: now,
            lastSeenAt: now,
            expiresAt,
          },
        });
      },
    );

    return {
      ...tokens,
      tokenType: 'Bearer',
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshTokenExpiresIn: this.refreshTtlSeconds,
    };
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
    });

    return { success: true, message: 'Logged out successfully' };
  }
  async logoutAll(userId: string) {
    const result = await this.revokeAllSessions(userId, 'LOGOUT_ALL');
    return {
      success: true,
      message: 'Logged out from all devices successfully',
      revokedSessions: result.count,
    };
  }

  /**
   * Frontend company-selector-এর জন্য: logged-in user কোন কোন company-র
   * active member তা এবং প্রতিটি company-তে তার effective permission
   * list — এই দুটোই একটামাত্র call-এ দেওয়ার জন্য (আলাদা "my permissions"
   * endpoint-এর প্রয়োজন এড়াতে)।
   */
  async getMyCompanies(userId: string) {
    const now = new Date();

    const memberships = await this.prisma.companyMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        company: {
          select: {
            legalName: true,
            tradeName: true,
            logoUrl: true,
            status: true,
            tenant: { select: { status: true } },
          },
        },
        roles: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            companyRole: { status: 'ACTIVE' },
          },
          select: {
            companyRole: {
              select: {
                code: true,
                permissions: {
                  where: { permission: { status: 'ACTIVE' } },
                  select: {
                    effect: true,
                    permission: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return memberships.map((member) => ({
      companyId: member.companyId,
      companyMemberId: member.id,
      tenantId: member.tenantId,
      companyName: member.company.tradeName || member.company.legalName,
      logoUrl: member.company.logoUrl,
      companyStatus: member.company.status,
      tenantStatus: member.company.tenant.status,
      roleCodes: member.roles.map((role) => role.companyRole.code),
      permissions: resolvePermissionEffects(member.roles),
    }));
  }

  private findPlatformUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        platformMember: {
          include: { roles: { include: { platformRole: true } } },
        },
        companyMemberships: {
          select: { id: true, status: true },
        },
      },
    });
  }

  private async unlockAndReloadUser(userId: string, email: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
    });
    const user = await this.findPlatformUserByEmail(email);
    if (!user) throw this.invalidCredentials();
    return user;
  }

  private activeRoleCodes(user: PlatformUser): string[] {
    return (
      user.platformMember?.roles
        .filter(
          (item: PlatformRoleAssignment) =>
            item.platformRole.status === 'ACTIVE',
        )
        .map((item: PlatformRoleAssignment) => item.platformRole.code) ?? []
    );
  }

  private toAuthenticatedUser(
    user: PlatformUser,
    sessionId: string,
    roles: string[],
  ): AuthenticatedUser {
    return {
      userId: user.id,
      sessionId,
      platformMemberId: user.platformMember?.id,
      email: user.email!,
      fullName: user.fullName,
      preferredLocale: user.preferredLocale,
      timezone: user.timezone,
      roles,
    };
  }

  // private hasActiveMembership(user: PlatformUser, roles: string[]): boolean {
  //   const hasPlatformMembership =
  //     user.platformMember?.status === "ACTIVE" && roles.length > 0;
  //   const hasCompanyMembership = user.companyMemberships.some(
  //     (membership) => membership.status === "ACTIVE",
  //   );
  //   return hasPlatformMembership || hasCompanyMembership;
  // }
  private hasActiveMembership(user: PlatformUser, roles: string[]): boolean {
    const hasPlatformMembership = this.hasActivePlatformMembership(user, roles);

    const hasCompanyMembership = user.companyMemberships.some(
      (membership) => membership.status === 'ACTIVE',
    );

    return hasPlatformMembership || hasCompanyMembership;
  }

  private hasActivePlatformMembership(
    user: PlatformUser,
    roles: string[],
  ): boolean {
    return user.platformMember?.status === 'ACTIVE' && roles.length > 0;
  }

  /**
   * `GET /auth/me` (called by the frontend's silent-refresh session
   * restore on every fresh page load) was returning the bare
   * `AuthenticatedUser` shape — no `userType`/`permissions` — while
   * `POST /auth/staff/login` returns the enriched shape. That contract
   * mismatch made the frontend lose all platform permission info on
   * every reload (frontend's `isPlatformStaffUser()` check requires
   * `userType === 'PLATFORM_STAFF'`). This mirrors `staffLogin`'s own
   * enrichment so both endpoints agree on one user shape.
   */
  async getCurrentUser(user: AuthenticatedUser) {
    if (!user.platformMemberId) {
      return user;
    }

    const permissions = await this.effectivePlatformPermissions(
      user.userId,
      user.roles,
    );

    return {
      ...user,
      userType: 'PLATFORM_STAFF' as const,
      permissions,
    };
  }

  private async effectivePlatformPermissions(
    userId: string,
    roles: string[],
  ): Promise<string[]> {
    if (roles.includes('SUPER_ADMIN')) {
      const permissions = await this.prisma.permission.findMany({
        where: {
          isSystem: true,
          status: 'ACTIVE',
        },
        select: {
          code: true,
        },
        orderBy: {
          code: 'asc',
        },
      });

      return permissions.map((permission) => permission.code);
    }

    const member = await this.prisma.platformMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        roles: {
          where: {
            platformRole: {
              status: 'ACTIVE',
            },
          },
          select: {
            platformRole: {
              select: {
                permissions: {
                  where: {
                    permission: {
                      status: 'ACTIVE',
                    },
                  },
                  select: {
                    effect: true,
                    permission: {
                      select: {
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const effects = new Map<string, Set<string>>();

    for (const assignment of member?.roles ?? []) {
      for (const item of assignment.platformRole.permissions) {
        const permissionEffects =
          effects.get(item.permission.code) ?? new Set<string>();

        permissionEffects.add(item.effect);
        effects.set(item.permission.code, permissionEffects);
      }
    }

    return [...effects.entries()]
      .filter(
        ([, permissionEffects]) =>
          permissionEffects.has('ALLOW') && !permissionEffects.has('DENY'),
      )
      .map(([code]) => code)
      .sort();
  }
  private async registerFailedLogin(
    user: PlatformUser,
    email: string,
    metadata: RequestMetadata,
  ) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= this.maxFailedAttempts;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + this.lockMinutes * 60_000)
      : null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          ...(shouldLock ? { status: 'LOCKED', lockedUntil } : {}),
        },
      }),
      this.prisma.loginEvent.create({
        data: {
          userId: user.id,
          email,
          success: false,
          reason: shouldLock ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
    ]);
  }

  private recordLoginEvent(
    userId: string | null,
    email: string,
    success: boolean,
    reason: string,
    metadata: RequestMetadata,
  ) {
    return this.prisma.loginEvent.create({
      data: {
        userId,
        email,
        success,
        reason,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  }

  private async issueTokenPair(
    userId: string,
    sessionId: string,
    roles: string[],
  ) {
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      roles,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      jti: randomUUID(),
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessSecret,
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: this.accessTtlSeconds,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: this.refreshTtlSeconds,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: this.refreshSecret,
          issuer: this.issuer,
          audience: this.audience,
        },
      );
      if (
        payload.type !== 'refresh' ||
        !payload.sid ||
        !payload.sub ||
        !payload.jti
      ) {
        throw new Error('Invalid payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private revokeAllSessions(userId: string, reason: string) {
    return this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  private invalidCredentials() {
    return new UnauthorizedException('Invalid email or password');
  }
}
