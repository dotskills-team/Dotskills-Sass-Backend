export const INDUSTRY_PERMISSIONS = {
  CREATE: 'industry:create',
  READ: 'industry:read',
  UPDATE: 'industry:update',
  STATUS_UPDATE: 'industry:status:update',
} as const;

export const INDUSTRY_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'code',
  'status',
] as const;

export const INDUSTRY_DEFAULT_PAGE = 1;
export const INDUSTRY_DEFAULT_LIMIT = 20;
export const INDUSTRY_MAX_LIMIT = 100;
