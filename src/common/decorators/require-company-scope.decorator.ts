import { SetMetadata } from '@nestjs/common';

export const COMPANY_SCOPE_KEY = 'dotskills:company-scope';

export type RequiredCompanyScope = {
  type: 'BRANCH' | 'WAREHOUSE' | 'POS_COUNTER';
  param: string;
};

export const RequireCompanyScope = (
  type: RequiredCompanyScope['type'],
  routeParamName: string,
) => SetMetadata(COMPANY_SCOPE_KEY, { type, param: routeParamName });
