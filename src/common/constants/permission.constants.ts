// export const PLATFORM_PERMISSIONS = {
//   STAFF_READ: "platform.staff.read",
//   STAFF_CREATE: "platform.staff.create",
//   STAFF_UPDATE: "platform.staff.update",
//   STAFF_STATUS: "platform.staff.status",
//   STAFF_ROLE_ASSIGN: "platform.staff.role.assign",
//   ROLE_READ: "platform.role.read",
//   ROLE_UPDATE: "platform.role.update",
//   ROLE_PERMISSION_ASSIGN: "platform.role.permission.assign",
//   COMPANY_RBAC_BOOTSTRAP: "company.rbac.bootstrap",
// } as const;

// export const COMPANY_PERMISSIONS = {
//   RBAC_READ: "company.rbac.read",
//   ROLE_CREATE: "company.role.create",
//   ROLE_UPDATE: "company.role.update",
//   ROLE_PERMISSION_ASSIGN: "company.role.permission.assign",
//   MEMBER_READ: "company.member.read",
//   MEMBER_CREATE: "company.member.create",
//   MEMBER_UPDATE: "company.member.update",
//   MEMBER_ROLE_ASSIGN: "company.member.role.assign",
//   MEMBER_SCOPE_ASSIGN: "company.member.scope.assign",
// } as const;



// export type PlatformPermissionCode =
//   (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];
// export type CompanyPermissionCode =
//   (typeof COMPANY_PERMISSIONS)[keyof typeof COMPANY_PERMISSIONS];



export const PLATFORM_PERMISSIONS = {
  // Platform Staff
  STAFF_READ: 'platform.staff.read',
  STAFF_CREATE: 'platform.staff.create',
  STAFF_UPDATE: 'platform.staff.update',
  STAFF_STATUS: 'platform.staff.status',
  STAFF_ROLE_ASSIGN: 'platform.staff.role.assign',

  // Platform Roles
  ROLE_READ: 'platform.role.read',
  ROLE_UPDATE: 'platform.role.update',
  ROLE_PERMISSION_ASSIGN: 'platform.role.permission.assign',

  // Company Management
  COMPANY_READ: 'platform.company.read',
  COMPANY_CREATE: 'platform.company.create',
  COMPANY_UPDATE: 'platform.company.update',
  COMPANY_STATUS: 'platform.company.status',
  COMPANY_ACTIVATE: 'platform.company.activate',
  COMPANY_SUSPEND: 'platform.company.suspend',

  /**
   * Company Owner Management
   */
  COMPANY_OWNER_READ:
    'platform.company.owner.read',

  COMPANY_OWNER_CREATE:
    'platform.company.owner.create',

  COMPANY_OWNER_UPDATE:
    'platform.company.owner.update',

  COMPANY_OWNER_CHANGE:
    'platform.company.owner.change',

  COMPANY_OWNER_STATUS:
    'platform.company.owner.status',


  // Company RBAC Bootstrap
  COMPANY_RBAC_BOOTSTRAP: 'company.rbac.bootstrap',
} as const;

export const COMPANY_PERMISSIONS = {
  RBAC_READ: 'company.rbac.read',
  ROLE_CREATE: 'company.role.create',
  ROLE_UPDATE: 'company.role.update',
  ROLE_PERMISSION_ASSIGN: 'company.role.permission.assign',
  MEMBER_READ: 'company.member.read',
  MEMBER_CREATE: 'company.member.create',
  MEMBER_UPDATE: 'company.member.update',
  MEMBER_ROLE_ASSIGN: 'company.member.role.assign',
  MEMBER_SCOPE_ASSIGN: 'company.member.scope.assign',
} as const;

export type PlatformPermissionCode =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

export type CompanyPermissionCode =
  (typeof COMPANY_PERMISSIONS)[keyof typeof COMPANY_PERMISSIONS];

