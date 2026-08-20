import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import type { AccessTokenPayload } from '../interfaces/jwt-payload.interface';

type PlatformRoleAssignment = {
  platformRole: { status: string; code: string };
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      issuer: configService.get<string>('JWT_ISSUER', 'dotskills-api'),
      audience: configService.get<string>('JWT_AUDIENCE', 'dotskills-web'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          include: {
            platformMember: {
              include: {
                roles: { include: { platformRole: true } },
              },
            },
            companyMemberships: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    const now = new Date();
    const user = session?.user;
    const platformMember = user?.platformMember;
    const roles =
      platformMember?.roles
        .filter(
          (item: PlatformRoleAssignment) =>
            item.platformRole.status === 'ACTIVE',
        )
        .map((item: PlatformRoleAssignment) => item.platformRole.code) ?? [];
    const hasPlatformMembership =
      platformMember?.status === 'ACTIVE' && roles.length > 0;
    const hasCompanyMembership =
      user?.companyMemberships.some(
        (membership) => membership.status === 'ACTIVE',
      ) ?? false;

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !user ||
      user.deletedAt ||
      user.status !== 'ACTIVE' ||
      !user.email ||
      (!hasPlatformMembership && !hasCompanyMembership)
    ) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    return {
      userId: user.id,
      sessionId: session.id,
      platformMemberId: platformMember?.id,
      email: user.email,
      fullName: user.fullName,
      preferredLocale: user.preferredLocale,
      timezone: user.timezone,
      roles,
    };
  }
}
