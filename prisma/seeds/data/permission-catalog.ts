export type PermissionDefinition = {
  code: string;
  moduleCode: string;
  resource: string;
  action: string;
  name: string;
  description: string;
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Platform staff
  {
    code: 'platform.staff.create',
    moduleCode: 'platform',
    resource: 'staff',
    action: 'create',
    name: 'Create platform staff',
    description: 'Create or invite a new platform staff member.',
  },
  {
    code: 'platform.staff.read',
    moduleCode: 'platform',
    resource: 'staff',
    action: 'read',
    name: 'View platform staff',
    description: 'View platform staff members and their details.',
  },
  {
    code: 'platform.staff.update',
    moduleCode: 'platform',
    resource: 'staff',
    action: 'update',
    name: 'Update platform staff',
    description: 'Update platform staff information.',
  },
  {
    code: 'platform.staff.deactivate',
    moduleCode: 'platform',
    resource: 'staff',
    action: 'deactivate',
    name: 'Deactivate platform staff',
    description: 'Deactivate a platform staff account.',
  },

  // Platform roles
  {
    code: 'platform.role.create',
    moduleCode: 'platform',
    resource: 'role',
    action: 'create',
    name: 'Create platform role',
    description: 'Create a custom platform role.',
  },
  {
    code: 'platform.role.read',
    moduleCode: 'platform',
    resource: 'role',
    action: 'read',
    name: 'View platform roles',
    description: 'View platform roles and permissions.',
  },
  {
    code: 'platform.role.update',
    moduleCode: 'platform',
    resource: 'role',
    action: 'update',
    name: 'Update platform role',
    description: 'Update platform role information and permissions.',
  },
  {
    code: 'platform.role.assign',
    moduleCode: 'platform',
    resource: 'role',
    action: 'assign',
    name: 'Assign platform role',
    description: 'Assign or remove roles from platform staff.',
  },

  // Companies
  {
    code: 'company.create',
    moduleCode: 'company',
    resource: 'company',
    action: 'create',
    name: 'Create company',
    description: 'Create and onboard a new company.',
  },
  {
    code: 'company.read',
    moduleCode: 'company',
    resource: 'company',
    action: 'read',
    name: 'View companies',
    description: 'View company profiles and operational information.',
  },
  {
    code: 'company.update',
    moduleCode: 'company',
    resource: 'company',
    action: 'update',
    name: 'Update company',
    description: 'Update company information.',
  },
  {
    code: 'company.suspend',
    moduleCode: 'company',
    resource: 'company',
    action: 'suspend',
    name: 'Suspend company',
    description: 'Suspend or reactivate a company.',
  },

  // Subscriptions
  {
    code: 'subscription.assign',
    moduleCode: 'subscription',
    resource: 'subscription',
    action: 'assign',
    name: 'Assign subscription',
    description: 'Assign a subscription plan to a company.',
  },
  {
    code: 'subscription.read',
    moduleCode: 'subscription',
    resource: 'subscription',
    action: 'read',
    name: 'View subscriptions',
    description: 'View company subscriptions.',
  },
  {
    code: 'subscription.update',
    moduleCode: 'subscription',
    resource: 'subscription',
    action: 'update',
    name: 'Update subscription',
    description: 'Upgrade, downgrade, renew, or cancel a subscription.',
  },

  // Billing
  {
    code: 'billing.read',
    moduleCode: 'billing',
    resource: 'billing',
    action: 'read',
    name: 'View billing',
    description: 'View billing, invoices, and payment information.',
  },
  {
    code: 'billing.collect',
    moduleCode: 'billing',
    resource: 'billing',
    action: 'collect',
    name: 'Collect payment',
    description: 'Record or collect subscription payments.',
  },
  {
    code: 'billing.refund',
    moduleCode: 'billing',
    resource: 'billing',
    action: 'refund',
    name: 'Process refund',
    description: 'Process an eligible payment refund.',
  },

  // Support
  {
    code: 'support.read',
    moduleCode: 'support',
    resource: 'support',
    action: 'read',
    name: 'View support cases',
    description: 'View company support requests.',
  },
  {
    code: 'support.manage',
    moduleCode: 'support',
    resource: 'support',
    action: 'manage',
    name: 'Manage support cases',
    description: 'Respond to, assign, update, and resolve support cases.',
  },

  // Audit
  {
    code: 'audit.read',
    moduleCode: 'audit',
    resource: 'audit',
    action: 'read',
    name: 'View audit logs',
    description: 'View platform and company audit logs.',
  },

  // Company staff
  {
    code: 'company.staff.create',
    moduleCode: 'company',
    resource: 'staff',
    action: 'create',
    name: 'Create company staff',
    description: 'Invite or create staff within a company.',
  },
  {
    code: 'company.staff.read',
    moduleCode: 'company',
    resource: 'staff',
    action: 'read',
    name: 'View company staff',
    description: 'View staff belonging to the current company.',
  },
  {
    code: 'company.staff.update',
    moduleCode: 'company',
    resource: 'staff',
    action: 'update',
    name: 'Update company staff',
    description: 'Update staff belonging to the current company.',
  },
  {
    code: 'company.staff.deactivate',
    moduleCode: 'company',
    resource: 'staff',
    action: 'deactivate',
    name: 'Deactivate company staff',
    description: 'Deactivate staff within the current company.',
  },

  // Company roles
  {
    code: 'company.role.create',
    moduleCode: 'company',
    resource: 'role',
    action: 'create',
    name: 'Create company role',
    description: 'Create a custom role within the current company.',
  },
  {
    code: 'company.role.read',
    moduleCode: 'company',
    resource: 'role',
    action: 'read',
    name: 'View company roles',
    description: 'View company roles and their permissions.',
  },
  {
    code: 'company.role.update',
    moduleCode: 'company',
    resource: 'role',
    action: 'update',
    name: 'Update company role',
    description: 'Update a company role and its permissions.',
  },
  {
    code: 'company.role.assign',
    moduleCode: 'company',
    resource: 'role',
    action: 'assign',
    name: 'Assign company role',
    description: 'Assign or remove roles from company staff.',
  },
  // Company Owners
{
  code: 'company.owner.create',
  moduleCode: 'company',
  resource: 'owner',
  action: 'create',
  name: 'Create company owner',
  description:
    'Create or assign a user as the primary owner of a company.',
},
{
  code: 'company.owner.read',
  moduleCode: 'company',
  resource: 'owner',
  action: 'read',
  name: 'View company owners',
  description:
    'View company owners and ownership information of a company.',
},
{
  code: 'company.owner.update',
  moduleCode: 'company',
  resource: 'owner',
  action: 'update',
  name: 'Update company owner',
  description:
    'Update company owner account and membership information.',
},
{
  code: 'company.owner.change',
  moduleCode: 'company',
  resource: 'owner',
  action: 'change',
  name: 'Change company owner',
  description:
    'Transfer primary ownership of a company to another active member.',
},
{
  code: 'company.owner.status',
  moduleCode: 'company',
  resource: 'owner',
  action: 'status',
  name: 'Update company owner status',
  description:
    'Update the status of a company owner membership.',
},
];

export const PERMISSION_CODES = Object.freeze(
  Object.fromEntries(
    PERMISSION_CATALOG.map((permission) => [
      permission.code
        .replace(/\./g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toUpperCase(),
      permission.code,
    ]),
  ),
);