// import { PlanStatus } from '../../../generated/phase-1-prisma';

import { PlanStatus } from 'src/generated/phase-1-prisma/enums';

export type IndustrySortField =
  'createdAt' | 'updatedAt' | 'name' | 'code' | 'status';

export type IndustrySortOrder = 'asc' | 'desc';

export interface IndustryListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface IndustryListResponse {
  data: unknown[];
  meta: IndustryListMeta;
}

export interface IndustryStatusChangeResult {
  id: string;
  status: PlanStatus;
}
