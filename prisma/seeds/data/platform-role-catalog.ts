export type PlatformRoleDefinition = {
  code: string;
  name: string;
  description: string;
  permissionCodes: string[];
};

const ALL_PLATFORM_PERMISSIONS = [
  'platform.staff.create',
  'platform.staff.read',
  'platform.staff.update',
  'platform.staff.deactivate',

  'platform.role.create',
  'platform.role.read',
  'platform.role.update',
  'platform.role.assign',

  'company.create',
  'company.read',
  'company.update',
  'company.suspend',

  'subscription.assign',
  'subscription.read',
  'subscription.update',

  'billing.read',
  'billing.collect',
  'billing.refund',

  'support.read',
  'support.manage',
  'audit.read',
];

export const PLATFORM_ROLE_CATALOG: PlatformRoleDefinition[] = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Complete administrative access to the DotSkills platform.',
    permissionCodes: ALL_PLATFORM_PERMISSIONS,
  },
  {
    code: 'PLATFORM_ADMIN',
    name: 'Platform Admin',
    description: 'Manages platform staff, companies, and subscriptions.',
    permissionCodes: [
      'platform.staff.create',
      'platform.staff.read',
      'platform.staff.update',
      'platform.staff.deactivate',
      'platform.role.read',
      'platform.role.assign',
      'company.create',
      'company.read',
      'company.update',
      'company.suspend',
      'subscription.assign',
      'subscription.read',
      'subscription.update',
      'support.read',
      'audit.read',
    ],
  },
  {
    code: 'SALES_MANAGER',
    name: 'Sales Manager',
    description: 'Manages company onboarding and subscription assignment.',
    permissionCodes: [
      'company.create',
      'company.read',
      'company.update',
      'subscription.assign',
      'subscription.read',
      'subscription.update',
      'billing.read',
    ],
  },
  {
    code: 'FINANCE_MANAGER',
    name: 'Finance Manager',
    description: 'Manages billing, collections, and refunds.',
    permissionCodes: [
      'company.read',
      'subscription.read',
      'billing.read',
      'billing.collect',
      'billing.refund',
      'audit.read',
    ],
  },
  {
    code: 'SUPPORT_MANAGER',
    name: 'Support Manager',
    description: 'Manages customer support operations.',
    permissionCodes: [
      'company.read',
      'subscription.read',
      'support.read',
      'support.manage',
    ],
  },
  {
    code: 'COMPLIANCE_OFFICER',
    name: 'Compliance Officer',
    description: 'Monitors companies, compliance, and audit records.',
    permissionCodes: [
      'platform.staff.read',
      'platform.role.read',
      'company.read',
      'subscription.read',
      'billing.read',
      'support.read',
      'audit.read',
    ],
  },
  {
    code: 'AUDITOR',
    name: 'Auditor',
    description: 'Read-only access to business and audit information.',
    permissionCodes: [
      'platform.staff.read',
      'platform.role.read',
      'company.read',
      'subscription.read',
      'billing.read',
      'support.read',
      'audit.read',
    ],
  },
  {
    code: 'PLATFORM_STAFF',
    name: 'Platform Staff',
    description: 'Basic platform staff role with limited read access.',
    permissionCodes: [
      'company.read',
      'subscription.read',
      'support.read',
    ],
  },
];