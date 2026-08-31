// src/common/constants/permission-catalog.ts

import {
  COMPANY_PERMISSIONS,
  PLATFORM_PERMISSIONS,
} from './permission.constants';

/**
 * ============================================================
 * PERMISSION CATALOG — SINGLE SOURCE OF TRUTH
 * ============================================================
 *
 * এই ফাইলে প্রতিটি Permission-এর code/moduleCode/resource/action/name
 * সংজ্ঞায়িত আছে। এই catalog দুই জায়গায় ব্যবহৃত হয়:
 *
 * 1. `POST /platform/access-control/setup` (runtime bootstrap,
 *    access-control-setup.service.ts)
 * 2. `prisma db seed` (prisma/seeds/seed-permissions.ts)
 *
 * আগে এই দুই জায়গার নিজস্ব, একে অপরের সাথে অসামঞ্জস্যপূর্ণ permission
 * code তালিকা ছিল — যেটা একটি real bug ছিল: `prisma db seed` চালালে
 * SUPER_ADMIN role থেকে `access-control-setup`-এর assign করা সব
 * permission মুছে যেত (deleteMany notIn logic)। এখন দুটোই এই একই
 * catalog ব্যবহার করে, তাই কখনো ভিন্ন হতে পারবে না।
 */
export type PermissionDefinition = {
  code: string;
  moduleCode: string;
  resource: string;
  action: string;
  name: string;
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // =====================================================
  // Platform Staff
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.STAFF_READ,
    moduleCode: 'platform_access',
    resource: 'staff',
    action: 'read',
    name: 'Read platform staff',
  },
  {
    code: PLATFORM_PERMISSIONS.STAFF_CREATE,
    moduleCode: 'platform_access',
    resource: 'staff',
    action: 'create',
    name: 'Create platform staff',
  },
  {
    code: PLATFORM_PERMISSIONS.STAFF_UPDATE,
    moduleCode: 'platform_access',
    resource: 'staff',
    action: 'update',
    name: 'Update platform staff',
  },
  {
    code: PLATFORM_PERMISSIONS.STAFF_STATUS,
    moduleCode: 'platform_access',
    resource: 'staff',
    action: 'status',
    name: 'Change platform staff status',
  },
  {
    code: PLATFORM_PERMISSIONS.STAFF_ROLE_ASSIGN,
    moduleCode: 'platform_access',
    resource: 'staff',
    action: 'role_assign',
    name: 'Assign platform staff roles',
  },

  // =====================================================
  // Platform Roles
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.ROLE_READ,
    moduleCode: 'platform_access',
    resource: 'role',
    action: 'read',
    name: 'Read platform roles',
  },
  {
    code: PLATFORM_PERMISSIONS.ROLE_CREATE,
    moduleCode: 'platform_access',
    resource: 'role',
    action: 'create',
    name: 'Create platform roles',
  },
  {
    code: PLATFORM_PERMISSIONS.ROLE_UPDATE,
    moduleCode: 'platform_access',
    resource: 'role',
    action: 'update',
    name: 'Update platform roles',
  },
  {
    code: PLATFORM_PERMISSIONS.ROLE_STATUS,
    moduleCode: 'platform_access',
    resource: 'role',
    action: 'status',
    name: 'Change platform role status',
  },
  {
    code: PLATFORM_PERMISSIONS.ROLE_PERMISSION_ASSIGN,
    moduleCode: 'platform_access',
    resource: 'role',
    action: 'permission_assign',
    name: 'Assign platform role permissions',
  },

  // =====================================================
  // Company Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.COMPANY_READ,
    moduleCode: 'company_management',
    resource: 'company',
    action: 'read',
    name: 'Read companies',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_CREATE,
    moduleCode: 'company_management',
    resource: 'company',
    action: 'create',
    name: 'Create companies',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_UPDATE,
    moduleCode: 'company_management',
    resource: 'company',
    action: 'update',
    name: 'Update companies',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_STATUS,
    moduleCode: 'company_management',
    resource: 'company',
    action: 'status',
    name: 'Change company status',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_ACTIVATE,
    moduleCode: 'company_management',
    resource: 'company',
    action: 'activate',
    name: 'Activate companies',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_SUSPEND,
    moduleCode: 'company_management',
    resource: 'company',
    action: 'suspend',
    name: 'Suspend companies',
  },

  // =====================================================
  // Company Owner Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.COMPANY_OWNER_READ,
    moduleCode: 'company_management',
    resource: 'company_owner',
    action: 'read',
    name: 'Read company owners',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_OWNER_CREATE,
    moduleCode: 'company_management',
    resource: 'company_owner',
    action: 'create',
    name: 'Create company owners',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_OWNER_UPDATE,
    moduleCode: 'company_management',
    resource: 'company_owner',
    action: 'update',
    name: 'Update company owners',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_OWNER_CHANGE,
    moduleCode: 'company_management',
    resource: 'company_owner',
    action: 'change',
    name: 'Change company owner',
  },
  {
    code: PLATFORM_PERMISSIONS.COMPANY_OWNER_STATUS,
    moduleCode: 'company_management',
    resource: 'company_owner',
    action: 'status',
    name: 'Change company owner status',
  },

  // =====================================================
  // Tenant Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.TENANT_CREATE,
    moduleCode: 'tenant_management',
    resource: 'tenant',
    action: 'create',
    name: 'Create tenants',
  },
  {
    code: PLATFORM_PERMISSIONS.TENANT_READ,
    moduleCode: 'tenant_management',
    resource: 'tenant',
    action: 'read',
    name: 'Read tenants',
  },
  {
    code: PLATFORM_PERMISSIONS.TENANT_UPDATE,
    moduleCode: 'tenant_management',
    resource: 'tenant',
    action: 'update',
    name: 'Update tenants',
  },
  {
    code: PLATFORM_PERMISSIONS.TENANT_STATUS,
    moduleCode: 'tenant_management',
    resource: 'tenant',
    action: 'status',
    name: 'Change tenant status',
  },
  {
    code: PLATFORM_PERMISSIONS.TENANT_DELETE,
    moduleCode: 'tenant_management',
    resource: 'tenant',
    action: 'delete',
    name: 'Delete tenants',
  },

  // =====================================================
  // Industry Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_READ,
    moduleCode: 'industry_management',
    resource: 'industry',
    action: 'read',
    name: 'Read industries',
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_CREATE,
    moduleCode: 'industry_management',
    resource: 'industry',
    action: 'create',
    name: 'Create industries',
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_UPDATE,
    moduleCode: 'industry_management',
    resource: 'industry',
    action: 'update',
    name: 'Update industries',
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_STATUS,
    moduleCode: 'industry_management',
    resource: 'industry',
    action: 'status',
    name: 'Change industry status',
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_ACTIVATE,
    moduleCode: 'industry_management',
    resource: 'industry',
    action: 'activate',
    name: 'Activate industries',
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_DEACTIVATE,
    moduleCode: 'industry_management',
    resource: 'industry',
    action: 'deactivate',
    name: 'Deactivate industries',
  },
  {
    code: PLATFORM_PERMISSIONS.INDUSTRY_DELETE,
    moduleCode: 'industry_management',
    resource: 'industry',
    action: 'delete',
    name: 'Delete industries',
  },

  // =====================================================
  // Billing Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.BILLING_CREATE,
    moduleCode: 'billing_management',
    resource: 'billing',
    action: 'create',
    name: 'Create billing records',
  },
  {
    code: PLATFORM_PERMISSIONS.BILLING_READ,
    moduleCode: 'billing_management',
    resource: 'billing',
    action: 'read',
    name: 'Read billing records',
  },
  {
    code: PLATFORM_PERMISSIONS.BILLING_PROCESS,
    moduleCode: 'billing_management',
    resource: 'billing',
    action: 'process',
    name: 'Process billing charges',
  },
  {
    code: PLATFORM_PERMISSIONS.BILLING_RETRY,
    moduleCode: 'billing_management',
    resource: 'billing',
    action: 'retry',
    name: 'Retry failed billing charges',
  },
  {
    code: PLATFORM_PERMISSIONS.BILLING_CANCEL,
    moduleCode: 'billing_management',
    resource: 'billing',
    action: 'cancel',
    name: 'Cancel billing records',
  },
  {
    code: PLATFORM_PERMISSIONS.BILLING_SKIP,
    moduleCode: 'billing_management',
    resource: 'billing',
    action: 'skip',
    name: 'Skip billing records',
  },
  {
    code: PLATFORM_PERMISSIONS.BILLING_MARK_SUCCEEDED,
    moduleCode: 'billing_management',
    resource: 'billing',
    action: 'mark_succeeded',
    name: 'Mark billing as succeeded',
  },
  {
    code: PLATFORM_PERMISSIONS.BILLING_MARK_FAILED,
    moduleCode: 'billing_management',
    resource: 'billing',
    action: 'mark_failed',
    name: 'Mark billing as failed',
  },

  // =====================================================
  // Invoice Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.INVOICE_CREATE,
    moduleCode: 'invoice_management',
    resource: 'invoice',
    action: 'create',
    name: 'Create invoices',
  },
  {
    code: PLATFORM_PERMISSIONS.INVOICE_READ,
    moduleCode: 'invoice_management',
    resource: 'invoice',
    action: 'read',
    name: 'Read invoices',
  },
  {
    code: PLATFORM_PERMISSIONS.INVOICE_ISSUE,
    moduleCode: 'invoice_management',
    resource: 'invoice',
    action: 'issue',
    name: 'Issue invoices',
  },
  {
    code: PLATFORM_PERMISSIONS.INVOICE_CANCEL,
    moduleCode: 'invoice_management',
    resource: 'invoice',
    action: 'cancel',
    name: 'Cancel invoices',
  },
  {
    code: PLATFORM_PERMISSIONS.INVOICE_VOID,
    moduleCode: 'invoice_management',
    resource: 'invoice',
    action: 'void',
    name: 'Void invoices',
  },
  {
    code: PLATFORM_PERMISSIONS.INVOICE_MARK_PAID,
    moduleCode: 'invoice_management',
    resource: 'invoice',
    action: 'mark_paid',
    name: 'Mark invoices as paid',
  },

  // =====================================================
  // Payment Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.PAYMENT_READ,
    moduleCode: 'payment_management',
    resource: 'payment',
    action: 'read',
    name: 'Read payments',
  },
  {
    code: PLATFORM_PERMISSIONS.PAYMENT_VERIFY,
    moduleCode: 'payment_management',
    resource: 'payment',
    action: 'verify',
    name: 'Manually verify/reconcile payments',
  },
  {
    code: PLATFORM_PERMISSIONS.PAYMENT_CANCEL,
    moduleCode: 'payment_management',
    resource: 'payment',
    action: 'cancel',
    name: 'Cancel payments',
  },

  // =====================================================
  // Company RBAC Bootstrap
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.COMPANY_RBAC_BOOTSTRAP,
    moduleCode: 'platform_access',
    resource: 'company_rbac',
    action: 'bootstrap',
    name: 'Bootstrap company RBAC',
  },

  // =====================================================
  // Feature Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.FEATURE_CREATE,
    moduleCode: 'feature_management',
    resource: 'feature',
    action: 'create',
    name: 'Create features',
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_READ,
    moduleCode: 'feature_management',
    resource: 'feature',
    action: 'read',
    name: 'Read features',
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_UPDATE,
    moduleCode: 'feature_management',
    resource: 'feature',
    action: 'update',
    name: 'Update features',
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_STATUS,
    moduleCode: 'feature_management',
    resource: 'feature',
    action: 'status',
    name: 'Change feature status',
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_ACTIVATE,
    moduleCode: 'feature_management',
    resource: 'feature',
    action: 'activate',
    name: 'Activate features',
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_DEACTIVATE,
    moduleCode: 'feature_management',
    resource: 'feature',
    action: 'deactivate',
    name: 'Deactivate features',
  },
  {
    code: PLATFORM_PERMISSIONS.FEATURE_ARCHIVE,
    moduleCode: 'feature_management',
    resource: 'feature',
    action: 'archive',
    name: 'Archive features',
  },

  // =====================================================
  // Plan Pricing
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.PLAN_PRICING_CREATE,
    moduleCode: 'plan_pricing',
    resource: 'plan_price',
    action: 'create',
    name: 'Create plan prices',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_PRICING_READ,
    moduleCode: 'plan_pricing',
    resource: 'plan_price',
    action: 'read',
    name: 'Read plan prices',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_PRICING_UPDATE,
    moduleCode: 'plan_pricing',
    resource: 'plan_price',
    action: 'update',
    name: 'Update plan prices',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_PRICING_STATUS,
    moduleCode: 'plan_pricing',
    resource: 'plan_price',
    action: 'status',
    name: 'Change plan price status',
  },

  // =====================================================
  // Plan Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.PLAN_READ,
    moduleCode: 'plan_management',
    resource: 'plan',
    action: 'read',
    name: 'Read plans',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_CREATE,
    moduleCode: 'plan_management',
    resource: 'plan',
    action: 'create',
    name: 'Create plans',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_UPDATE,
    moduleCode: 'plan_management',
    resource: 'plan',
    action: 'update',
    name: 'Update plans',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_STATUS,
    moduleCode: 'plan_management',
    resource: 'plan',
    action: 'status',
    name: 'Change plan status',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_ARCHIVE,
    moduleCode: 'plan_management',
    resource: 'plan',
    action: 'archive',
    name: 'Archive plans',
  },

  // =====================================================
  // Plan Feature Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.PLAN_FEATURE_READ,
    moduleCode: 'plan_management',
    resource: 'plan_feature',
    action: 'read',
    name: 'Read plan features',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_FEATURE_ASSIGN,
    moduleCode: 'plan_management',
    resource: 'plan_feature',
    action: 'assign',
    name: 'Assign features to plans',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_FEATURE_UPDATE,
    moduleCode: 'plan_management',
    resource: 'plan_feature',
    action: 'update',
    name: 'Update plan feature assignments',
  },
  {
    code: PLATFORM_PERMISSIONS.PLAN_FEATURE_REMOVE,
    moduleCode: 'plan_management',
    resource: 'plan_feature',
    action: 'remove',
    name: 'Remove features from plans',
  },

  // =====================================================
  // Platform Subscription Management
  // =====================================================
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_CREATE,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'create',
    name: 'Create platform subscriptions',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'read',
    name: 'Read platform subscriptions',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_AUTO_RENEW,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'auto_renew',
    name: 'Toggle platform subscription auto-renew',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_UPDATE,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'update',
    name: 'Update platform subscriptions',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_CHANGE_PLAN,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'change_plan',
    name: 'Change platform subscription plan',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_CANCEL,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'cancel',
    name: 'Cancel platform subscriptions',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_RENEW,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'renew',
    name: 'Renew platform subscriptions',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_SUSPEND,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'suspend',
    name: 'Suspend platform subscriptions',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_REACTIVATE,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'reactivate',
    name: 'Reactivate platform subscriptions',
  },
  {
    code: PLATFORM_PERMISSIONS.SUBSCRIPTION_EXPIRE,
    moduleCode: 'subscription_management',
    resource: 'subscription',
    action: 'expire',
    name: 'Expire platform subscriptions',
  },

  // =====================================================
  // Company RBAC
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.RBAC_READ,
    moduleCode: 'company_access',
    resource: 'rbac',
    action: 'read',
    name: 'Read company RBAC',
  },
  {
    code: COMPANY_PERMISSIONS.ROLE_CREATE,
    moduleCode: 'company_access',
    resource: 'role',
    action: 'create',
    name: 'Create company roles',
  },
  {
    code: COMPANY_PERMISSIONS.ROLE_UPDATE,
    moduleCode: 'company_access',
    resource: 'role',
    action: 'update',
    name: 'Update company roles',
  },
  {
    code: COMPANY_PERMISSIONS.ROLE_PERMISSION_ASSIGN,
    moduleCode: 'company_access',
    resource: 'role',
    action: 'permission_assign',
    name: 'Assign company role permissions',
  },

  // =====================================================
  // Company Member Management
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.MEMBER_READ,
    moduleCode: 'company_access',
    resource: 'member',
    action: 'read',
    name: 'Read company members',
  },
  {
    code: COMPANY_PERMISSIONS.MEMBER_CREATE,
    moduleCode: 'company_access',
    resource: 'member',
    action: 'create',
    name: 'Create company members',
  },
  {
    code: COMPANY_PERMISSIONS.MEMBER_UPDATE,
    moduleCode: 'company_access',
    resource: 'member',
    action: 'update',
    name: 'Update company members',
  },
  {
    code: COMPANY_PERMISSIONS.MEMBER_ROLE_ASSIGN,
    moduleCode: 'company_access',
    resource: 'member',
    action: 'role_assign',
    name: 'Assign company member roles',
  },
  {
    code: COMPANY_PERMISSIONS.MEMBER_SCOPE_ASSIGN,
    moduleCode: 'company_access',
    resource: 'member',
    action: 'scope_assign',
    name: 'Assign company member scopes',
  },

  // =====================================================
  // Company Subscription Management
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.SUBSCRIPTION_READ,
    moduleCode: 'company_subscription',
    resource: 'subscription',
    action: 'read',
    name: 'Read own company subscription',
  },
  {
    code: COMPANY_PERMISSIONS.SUBSCRIPTION_AUTO_RENEW,
    moduleCode: 'company_subscription',
    resource: 'subscription',
    action: 'auto_renew',
    name: 'Update own company subscription auto-renew',
  },
  {
    code: COMPANY_PERMISSIONS.SUBSCRIPTION_CHANGE_PLAN,
    moduleCode: 'company_subscription',
    resource: 'subscription',
    action: 'change_plan',
    name: 'Change own company subscription plan',
  },
  {
    code: COMPANY_PERMISSIONS.SUBSCRIPTION_CANCEL,
    moduleCode: 'company_subscription',
    resource: 'subscription',
    action: 'cancel',
    name: 'Cancel own company subscription',
  },
  {
    code: COMPANY_PERMISSIONS.SUBSCRIPTION_REACTIVATE,
    moduleCode: 'company_subscription',
    resource: 'subscription',
    action: 'reactivate',
    name: 'Reactivate own company subscription',
  },

  // =====================================================
  // Company Invoice (read-only)
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.INVOICE_READ,
    moduleCode: 'company_invoice',
    resource: 'invoice',
    action: 'read',
    name: 'Read own company invoices',
  },

  // =====================================================
  // Company Payment
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.PAYMENT_CREATE,
    moduleCode: 'company_payment',
    resource: 'payment',
    action: 'create',
    name: 'Initiate payment for own company invoice',
  },
  {
    code: COMPANY_PERMISSIONS.PAYMENT_READ,
    moduleCode: 'company_payment',
    resource: 'payment',
    action: 'read',
    name: 'Read own company payments',
  },

  // =====================================================
  // COMPANY BUSINESS OPS — MASTER DATA
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.LOCATION_READ,
    moduleCode: 'company_master_data',
    resource: 'location',
    action: 'read',
    name: 'Read company locations',
  },
  {
    code: COMPANY_PERMISSIONS.LOCATION_CREATE,
    moduleCode: 'company_master_data',
    resource: 'location',
    action: 'create',
    name: 'Create company locations',
  },
  {
    code: COMPANY_PERMISSIONS.LOCATION_UPDATE,
    moduleCode: 'company_master_data',
    resource: 'location',
    action: 'update',
    name: 'Update company locations',
  },
  {
    code: COMPANY_PERMISSIONS.CATEGORY_READ,
    moduleCode: 'company_master_data',
    resource: 'category',
    action: 'read',
    name: 'Read company categories',
  },
  {
    code: COMPANY_PERMISSIONS.CATEGORY_CREATE,
    moduleCode: 'company_master_data',
    resource: 'category',
    action: 'create',
    name: 'Create company categories',
  },
  {
    code: COMPANY_PERMISSIONS.CATEGORY_UPDATE,
    moduleCode: 'company_master_data',
    resource: 'category',
    action: 'update',
    name: 'Update company categories',
  },
  {
    code: COMPANY_PERMISSIONS.UNIT_READ,
    moduleCode: 'company_master_data',
    resource: 'unit',
    action: 'read',
    name: 'Read company units',
  },
  {
    code: COMPANY_PERMISSIONS.UNIT_CREATE,
    moduleCode: 'company_master_data',
    resource: 'unit',
    action: 'create',
    name: 'Create company units',
  },
  {
    code: COMPANY_PERMISSIONS.UNIT_UPDATE,
    moduleCode: 'company_master_data',
    resource: 'unit',
    action: 'update',
    name: 'Update company units',
  },
  {
    code: COMPANY_PERMISSIONS.PRODUCT_READ,
    moduleCode: 'company_master_data',
    resource: 'product',
    action: 'read',
    name: 'Read company products',
  },
  {
    code: COMPANY_PERMISSIONS.PRODUCT_CREATE,
    moduleCode: 'company_master_data',
    resource: 'product',
    action: 'create',
    name: 'Create company products',
  },
  {
    code: COMPANY_PERMISSIONS.PRODUCT_UPDATE,
    moduleCode: 'company_master_data',
    resource: 'product',
    action: 'update',
    name: 'Update company products',
  },
  {
    code: COMPANY_PERMISSIONS.PRODUCT_BULK_IMPORT,
    moduleCode: 'company_master_data',
    resource: 'product',
    action: 'bulk-import',
    name: 'Bulk import products',
  },
  {
    code: COMPANY_PERMISSIONS.CUSTOMER_READ,
    moduleCode: 'company_master_data',
    resource: 'customer',
    action: 'read',
    name: 'Read company customers',
  },
  {
    code: COMPANY_PERMISSIONS.CUSTOMER_CREATE,
    moduleCode: 'company_master_data',
    resource: 'customer',
    action: 'create',
    name: 'Create company customers',
  },
  {
    code: COMPANY_PERMISSIONS.CUSTOMER_UPDATE,
    moduleCode: 'company_master_data',
    resource: 'customer',
    action: 'update',
    name: 'Update company customers',
  },
  {
    code: COMPANY_PERMISSIONS.SUPPLIER_READ,
    moduleCode: 'company_master_data',
    resource: 'supplier',
    action: 'read',
    name: 'Read company suppliers',
  },
  {
    code: COMPANY_PERMISSIONS.SUPPLIER_CREATE,
    moduleCode: 'company_master_data',
    resource: 'supplier',
    action: 'create',
    name: 'Create company suppliers',
  },
  {
    code: COMPANY_PERMISSIONS.SUPPLIER_UPDATE,
    moduleCode: 'company_master_data',
    resource: 'supplier',
    action: 'update',
    name: 'Update company suppliers',
  },
  {
    code: COMPANY_PERMISSIONS.SETTINGS_READ,
    moduleCode: 'company_master_data',
    resource: 'settings',
    action: 'read',
    name: 'Read company business settings',
  },
  {
    code: COMPANY_PERMISSIONS.SETTINGS_UPDATE,
    moduleCode: 'company_master_data',
    resource: 'settings',
    action: 'update',
    name: 'Update company business settings',
  },

  // =====================================================
  // COMPANY BUSINESS OPS — PURCHASE + STOCK TRANSFER
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.PURCHASE_ORDER_READ,
    moduleCode: 'company_purchase',
    resource: 'purchase-order',
    action: 'read',
    name: 'Read purchase orders',
  },
  {
    code: COMPANY_PERMISSIONS.PURCHASE_ORDER_CREATE,
    moduleCode: 'company_purchase',
    resource: 'purchase-order',
    action: 'create',
    name: 'Create purchase orders',
  },
  {
    code: COMPANY_PERMISSIONS.PURCHASE_ORDER_UPDATE,
    moduleCode: 'company_purchase',
    resource: 'purchase-order',
    action: 'update',
    name: 'Update draft purchase orders',
  },
  {
    code: COMPANY_PERMISSIONS.PURCHASE_ORDER_CANCEL,
    moduleCode: 'company_purchase',
    resource: 'purchase-order',
    action: 'cancel',
    name: 'Cancel draft purchase orders',
  },
  {
    code: COMPANY_PERMISSIONS.PURCHASE_ORDER_RECEIVE,
    moduleCode: 'company_purchase',
    resource: 'purchase-order',
    action: 'receive',
    name: 'Receive goods against a purchase order',
  },
  {
    code: COMPANY_PERMISSIONS.PURCHASE_RETURN_READ,
    moduleCode: 'company_purchase',
    resource: 'purchase-return',
    action: 'read',
    name: 'Read purchase returns',
  },
  {
    code: COMPANY_PERMISSIONS.PURCHASE_RETURN_CREATE,
    moduleCode: 'company_purchase',
    resource: 'purchase-return',
    action: 'create',
    name: 'Create purchase returns',
  },
  {
    code: COMPANY_PERMISSIONS.STOCK_TRANSFER_READ,
    moduleCode: 'company_purchase',
    resource: 'stock-transfer',
    action: 'read',
    name: 'Read stock transfers',
  },
  {
    code: COMPANY_PERMISSIONS.STOCK_TRANSFER_CREATE,
    moduleCode: 'company_purchase',
    resource: 'stock-transfer',
    action: 'create',
    name: 'Create stock transfers',
  },
  {
    code: COMPANY_PERMISSIONS.STOCK_TRANSFER_DISPATCH,
    moduleCode: 'company_purchase',
    resource: 'stock-transfer',
    action: 'dispatch',
    name: 'Dispatch a stock transfer',
  },
  {
    code: COMPANY_PERMISSIONS.STOCK_TRANSFER_RECEIVE,
    moduleCode: 'company_purchase',
    resource: 'stock-transfer',
    action: 'receive',
    name: 'Receive a stock transfer',
  },
  {
    code: COMPANY_PERMISSIONS.SUPPLIER_PAYMENT_READ,
    moduleCode: 'company_purchase',
    resource: 'supplier-payment',
    action: 'read',
    name: 'Read supplier payments',
  },
  {
    code: COMPANY_PERMISSIONS.SUPPLIER_PAYMENT_CREATE,
    moduleCode: 'company_purchase',
    resource: 'supplier-payment',
    action: 'create',
    name: 'Record a supplier payment',
  },

  // =====================================================
  // COMPANY BUSINESS OPS — SALES / POS
  // =====================================================
  {
    code: COMPANY_PERMISSIONS.SALE_READ,
    moduleCode: 'company_sales',
    resource: 'sale',
    action: 'read',
    name: 'Read sales',
  },
  {
    code: COMPANY_PERMISSIONS.SALE_CREATE,
    moduleCode: 'company_sales',
    resource: 'sale',
    action: 'create',
    name: 'Create a sale',
  },
  {
    code: COMPANY_PERMISSIONS.SALE_VOID,
    moduleCode: 'company_sales',
    resource: 'sale',
    action: 'void',
    name: 'Void a sale',
  },
  {
    code: COMPANY_PERMISSIONS.SALE_RETURN_READ,
    moduleCode: 'company_sales',
    resource: 'sale-return',
    action: 'read',
    name: 'Read sale returns',
  },
  {
    code: COMPANY_PERMISSIONS.SALE_RETURN_CREATE,
    moduleCode: 'company_sales',
    resource: 'sale-return',
    action: 'create',
    name: 'Create a sale return',
  },
  {
    code: COMPANY_PERMISSIONS.CUSTOMER_PAYMENT_READ,
    moduleCode: 'company_sales',
    resource: 'customer-payment',
    action: 'read',
    name: 'Read customer payments',
  },
  {
    code: COMPANY_PERMISSIONS.CUSTOMER_PAYMENT_CREATE,
    moduleCode: 'company_sales',
    resource: 'customer-payment',
    action: 'create',
    name: 'Record a customer payment',
  },
  {
    code: COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_READ,
    moduleCode: 'company_sales',
    resource: 'cash-drawer-session',
    action: 'read',
    name: 'Read cash drawer sessions',
  },
  {
    code: COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_OPEN,
    moduleCode: 'company_sales',
    resource: 'cash-drawer-session',
    action: 'open',
    name: 'Open a cash drawer session',
  },
  {
    code: COMPANY_PERMISSIONS.CASH_DRAWER_SESSION_CLOSE,
    moduleCode: 'company_sales',
    resource: 'cash-drawer-session',
    action: 'close',
    name: 'Close a cash drawer session',
  },
  {
    code: COMPANY_PERMISSIONS.REPORT_READ,
    moduleCode: 'company_reporting',
    resource: 'report',
    action: 'read',
    name: 'Read business reports',
  },
  {
    code: COMPANY_PERMISSIONS.PROFIT_REPORT_READ,
    moduleCode: 'company_reporting',
    resource: 'profit-report',
    action: 'read',
    name: 'Read the profit report',
  },
];

/**
 * SUPER_ADMIN role সবসময় সব Platform permission পায় — runtime
 * bootstrap (`access-control-setup`) এবং `prisma db seed` দুটোই এই
 * একই তালিকা ব্যবহার করে, তাই কখনো ভিন্ন হতে পারবে না।
 */
export const SUPER_ADMIN_PERMISSION_CODES: readonly string[] =
  Object.values(PLATFORM_PERMISSIONS);

/**
 * PLATFORM_ADMIN role-এর ডিফল্ট permission সেট — runtime bootstrap
 * এবং `prisma db seed` দুটোই এই একই তালিকা ব্যবহার করে।
 */
export const PLATFORM_ADMIN_PERMISSION_CODES: readonly string[] = [
  PLATFORM_PERMISSIONS.STAFF_READ,
  PLATFORM_PERMISSIONS.STAFF_CREATE,
  PLATFORM_PERMISSIONS.STAFF_UPDATE,
  PLATFORM_PERMISSIONS.STAFF_STATUS,
  PLATFORM_PERMISSIONS.STAFF_ROLE_ASSIGN,
  PLATFORM_PERMISSIONS.ROLE_READ,
  PLATFORM_PERMISSIONS.COMPANY_RBAC_BOOTSTRAP,
];
