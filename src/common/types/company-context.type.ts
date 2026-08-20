export type CompanyScope = {
  type: 'COMPANY' | 'BRANCH' | 'WAREHOUSE' | 'POS_COUNTER';
  key: string;
};

export type CompanyContext = {
  tenantId: string;
  companyId: string;
  companyMemberId: string;
  companyStatus: string;
  tenantStatus: string;
  scopes: CompanyScope[];
};
