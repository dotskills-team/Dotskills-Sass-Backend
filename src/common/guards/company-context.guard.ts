import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../types/authenticated-user.type";
import type { CompanyContext } from "../types/company-context.type";

type CompanyRequest = Request & {
  user: AuthenticatedUser;
  companyContext: CompanyContext;
};

@Injectable()
export class CompanyContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CompanyRequest>();
    // const routeCompanyId = String(request.params.companyId ?? "");
    // const headerCompanyId = request.header("x-company-id") ?? "";
    // if (!routeCompanyId || !headerCompanyId || routeCompanyId !== headerCompanyId) {
    //   throw new BadRequestException(
    //     "x-company-id header must match the companyId route parameter",
    //   );
    // }
    const routeCompanyId = String(
      request.params.companyId ?? "",
    ).trim();

    const headerCompanyId = String(
      request.header("x-company-id") ?? "",
    ).trim();

    if (!headerCompanyId) {
      throw new BadRequestException(
        "x-company-id header is required",
      );
    }

    if (
      routeCompanyId &&
      routeCompanyId !== headerCompanyId
    ) {
      throw new BadRequestException(
        "x-company-id header must match the companyId route parameter",
      );
    }

    const resolvedCompanyId =
      routeCompanyId || headerCompanyId;



    const now = new Date();
    const member = await this.prisma.companyMember.findFirst({
      where: {
        userId: request.user.userId,
        // companyId: routeCompanyId,
        companyId: resolvedCompanyId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        tenantId: true,
        companyId: true,
        company: {
          select: {
            status: true,
            tenant: { select: { status: true } },
          },
        },
        scopes: {
          where: {
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          },
          select: { scopeType: true, scopeKey: true },
        },
      },
    });

    if (!member) throw new ForbiddenException("Company membership is not active");
    if (["SUSPENDED", "CLOSED"].includes(member.company.status)) {
      throw new ForbiddenException("Company is unavailable");
    }
    if (["SUSPENDED", "CANCELLED"].includes(member.company.tenant.status)) {
      throw new ForbiddenException("Tenant is unavailable");
    }

    request.companyContext = {
      tenantId: member.tenantId,
      companyId: member.companyId,
      companyMemberId: member.id,
      companyStatus: member.company.status,
      tenantStatus: member.company.tenant.status,
      scopes: member.scopes.map((scope) => ({
        type: scope.scopeType,
        key: scope.scopeKey,
      })),
    };
    return true;
  }
}
