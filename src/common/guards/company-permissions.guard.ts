import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { COMPANY_PERMISSIONS_KEY } from "../decorators/require-company-permissions.decorator";
import type { CompanyContext } from "../types/company-context.type";

type CompanyRequest = Request & { companyContext: CompanyContext };

@Injectable()
export class CompanyPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      COMPANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<CompanyRequest>();
    const companyContext = request.companyContext;
    if (!companyContext) throw new ForbiddenException("Company context is missing");
    const now = new Date();

    const assignments = await this.prisma.companyMemberRole.findMany({
      where: {
        companyMemberId: companyContext.companyMemberId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        companyRole: {
          companyId: companyContext.companyId,
          tenantId: companyContext.tenantId,
          status: "ACTIVE",
        },
      },
      select: {
        companyRole: {
          select: {
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
    });

    const effects = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      for (const item of assignment.companyRole.permissions) {
        const set = effects.get(item.permission.code) ?? new Set<string>();
        set.add(item.effect);
        effects.set(item.permission.code, set);
      }
    }

    const allowed = required.every((code) => {
      const set = effects.get(code);
      return Boolean(set?.has("ALLOW") && !set.has("DENY"));
    });
    if (!allowed) throw new ForbiddenException("Required company permission is missing");
    return true;
  }
}
