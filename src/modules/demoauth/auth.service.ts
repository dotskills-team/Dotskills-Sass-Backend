import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "../../generated/phase-1-prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
import type { LoginDto } from "./dto/login.dto";
import type { RefreshTokenDto } from "./dto/refresh-token.dto";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  RequestMetadata,
} from "./interfaces/jwt-payload.interface";

type PlatformUser = Prisma.UserGetPayload<{
  include: {
    platformMember: {
      include: { roles: { include: { platformRole: true } } };
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
    this.accessSecret = configService.getOrThrow<string>("JWT_ACCESS_SECRET");
    this.refreshSecret = configService.getOrThrow<string>("JWT_REFRESH_SECRET");
    this.issuer = configService.get<string>("JWT_ISSUER", "dotskills-api");
    this.audience = configService.get<string>("JWT_AUDIENCE", "dotskills-web");
    this.accessTtlSeconds = Number(
      configService.getOrThrow<string>("JWT_ACCESS_TTL_SECONDS"),
    );
    this.refreshTtlSeconds = Number(
      configService.getOrThrow<string>("JWT_REFRESH_TTL_SECONDS"),
    );
    this.maxFailedAttempts = Number(
      configService.getOrThrow<string>("AUTH_MAX_FAILED_ATTEMPTS"),
    );
    this.lockMinutes = Number(
      configService.getOrThrow<string>("AUTH_LOCK_MINUTES"),
    );
    this.dummyHashPromise = argon2.hash(randomBytes(32), this.argonOptions());
  }

  async login(dto: LoginDto, metadata: RequestMetadata) {
    const email = dto.email.trim().toLowerCase();
    let user = await this.findPlatformUserByEmail(email);
    const now = new Date();

    if (!user) {
      await this.verifyPassword(await this.dummyHashPromise, dto.password);
      await this.recordLoginEvent(
        null,
        email,
        false,
        "INVALID_CREDENTIALS",
        metadata,
      );
      throw this.invalidCredentials();
    }

    if (
      user.status === "LOCKED" &&
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
        "ACCOUNT_LOCKED",
        metadata,
      );
      throw this.invalidCredentials();
    }

    if (user.status !== "ACTIVE" || user.deletedAt) {
      await this.recordLoginEvent(
        user.id,
        email,
        false,
        "ACCOUNT_UNAVAILABLE",
        metadata,
      );
      throw this.invalidCredentials();
    }

    const roles = this.activeRoleCodes(user);
    if (
      user.platformMember?.status !== "ACTIVE" ||
      !roles.includes("SUPER_ADMIN")
    ) {
      await this.recordLoginEvent(
        user.id,
        email,
        false,
        "PLATFORM_ACCESS_DENIED",
        metadata,
      );
      throw this.invalidCredentials();
    }

    const passwordIsValid = user.passwordHash
      ? await this.verifyPassword(user.passwordHash, dto.password)
      : false;

    if (!passwordIsValid) {
      await this.registerFailedLogin(user, email, metadata);
      throw this.invalidCredentials();
    }

    const upgradedPasswordHash = user.passwordHash!.startsWith("$argon2")
      ? undefined
      : await argon2.hash(dto.password, this.argonOptions());

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
          reason: "LOGIN_SUCCESS",
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      }),
    ]);

    return {
      ...tokens,
      tokenType: "Bearer",
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshTokenExpiresIn: this.refreshTtlSeconds,
      user: this.toAuthenticatedUser(user, sessionId, roles),
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
          },
        },
      },
    });

    if (
      !session ||
      session.id !== payload.sid ||
      session.userId !== payload.sub
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (session.revokedAt) {
      if (session.replacedByHash) {
        await this.revokeAllSessions(session.userId, "REFRESH_TOKEN_REUSE");
      }
      throw new UnauthorizedException("Refresh token has been revoked");
    }

    const now = new Date();
    if (session.expiresAt <= now) {
      await this.prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: "EXPIRED" },
      });
      throw new UnauthorizedException("Refresh token has expired");
    }

    const user = session.user;
    const roles = this.activeRoleCodes(user);
    if (
      user.deletedAt ||
      user.status !== "ACTIVE" ||
      user.platformMember?.status !== "ACTIVE" ||
      !roles.includes("SUPER_ADMIN")
    ) {
      await this.revokeAllSessions(user.id, "ACCOUNT_UNAVAILABLE");
      throw new UnauthorizedException("Account is unavailable");
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
            revokeReason: "ROTATED",
            replacedByHash: newRefreshHash,
            lastSeenAt: now,
          },
        });

        if (revoked.count !== 1) {
          throw new UnauthorizedException("Refresh token was already used");
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
      tokenType: "Bearer",
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshTokenExpiresIn: this.refreshTtlSeconds,
    };
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
    });

    return { success: true, message: "Logged out successfully" };
  }

  async logoutAll(userId: string) {
    const result = await this.revokeAllSessions(userId, "LOGOUT_ALL");
    return {
      success: true,
      message: "Logged out from all devices successfully",
      revokedSessions: result.count,
    };
  }

  private findPlatformUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        platformMember: {
          include: { roles: { include: { platformRole: true } } },
        },
      },
    });
  }

  private async unlockAndReloadUser(userId: string, email: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", failedLoginCount: 0, lockedUntil: null },
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
            item.platformRole.status === "ACTIVE",
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
      email: user.email!,
      fullName: user.fullName,
      preferredLocale: user.preferredLocale,
      timezone: user.timezone,
      roles,
    };
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
          ...(shouldLock ? { status: "LOCKED", lockedUntil } : {}),
        },
      }),
      this.prisma.loginEvent.create({
        data: {
          userId: user.id,
          email,
          success: false,
          reason: shouldLock ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
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
      type: "access",
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      jti: randomUUID(),
      type: "refresh",
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
        payload.type !== "refresh" ||
        !payload.sid ||
        !payload.sub ||
        !payload.jti
      ) {
        throw new Error("Invalid payload");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  private async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    try {
      if (hash.startsWith("$argon2"))
        return await argon2.verify(hash, password);
      if (/^\$2[aby]\$/.test(hash)) return await bcrypt.compare(password, hash);
      return false;
    } catch {
      return false;
    }
  }

  private argonOptions(): argon2.Options & { raw?: false } {
    return {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private revokeAllSessions(userId: string, reason: string) {
    return this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  private invalidCredentials() {
    return new UnauthorizedException("Invalid email or password");
  }
}
