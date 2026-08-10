import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PLATFORM_PERMISSIONS_KEY,
} from "../decorators/require-platform-permissions.decorator";
import type { AuthenticatedUser } from "../types/authenticated-user.type";

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PLATFORM_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.userId;
    if (!userId) throw new ForbiddenException("Platform access denied");

    const member = await this.prisma.platformMember.findFirst({
      where: { userId, status: "ACTIVE" },
      select: {
        roles: {
          where: { platformRole: { status: "ACTIVE" } },
          select: {
            platformRole: {
              select: {
                code: true,
                permissions: {
                  where: {
                    permission: { code: { in: required }, status: "ACTIVE" },
                  },
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

    if (!member) throw new ForbiddenException("Platform access denied");
    const roleCodes = member.roles.map((item) => item.platformRole.code);
    if (roleCodes.includes("SUPER_ADMIN")) return true;

    const effects = new Map<string, Set<string>>();
    for (const assignment of member.roles) {
      for (const item of assignment.platformRole.permissions) {
        const set = effects.get(item.permission.code) ?? new Set<string>();
        set.add(item.effect);
        effects.set(item.permission.code, set);
      }
    }

    const allowed = required.every((code) => {
      const set = effects.get(code);
      return Boolean(set?.has("ALLOW") && !set.has("DENY"));
    });
    if (!allowed) throw new ForbiddenException("Required platform permission is missing");
    return true;
  }
}
