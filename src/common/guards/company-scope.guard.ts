import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import {
  COMPANY_SCOPE_KEY,
  type RequiredCompanyScope,
} from "../decorators/require-company-scope.decorator";
import type { CompanyContext } from "../types/company-context.type";

type CompanyRequest = Request & { companyContext: CompanyContext };

@Injectable()
export class CompanyScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredCompanyScope>(
      COMPANY_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<CompanyRequest>();
    const scopeKey = String(request.params[required.param] ?? "");
    const scopes = request.companyContext?.scopes ?? [];
    const hasCompanyWide = scopes.some(
      (scope) => scope.type === "COMPANY" && scope.key === "*",
    );
    const hasExact = scopes.some(
      (scope) => scope.type === required.type && scope.key === scopeKey,
    );
    if (!scopeKey || (!hasCompanyWide && !hasExact)) {
      throw new ForbiddenException("Requested resource is outside the assigned data scope");
    }
    return true;
  }
}
