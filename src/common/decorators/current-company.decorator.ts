import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { CompanyContext } from '../types/company-context.type';

type CompanyRequest = Request & { companyContext: CompanyContext };

export const CurrentCompany = createParamDecorator(
  (field: keyof CompanyContext | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<CompanyRequest>();
    return field ? request.companyContext[field] : request.companyContext;
  },
);
