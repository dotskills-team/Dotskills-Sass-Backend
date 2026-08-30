// src/common/constants/permission.constants.ts

/**
 * ============================================================
 * PERMISSION CONSTANTS
 * ============================================================
 *
 * এই ফাইলে DotSkills application-এর সব strongly-typed
 * Platform এবং Company permission code রাখা হয়েছে।
 *
 * গুরুত্বপূর্ণ নিয়ম:
 *
 * 1. PLATFORM_PERMISSIONS:
 *    Super Admin ও Platform Staff-এর জন্য।
 *
 * 2. COMPANY_PERMISSIONS:
 *    Company Owner ও Company-scoped roles-এর জন্য।
 *
 * 3. Permission string database-এ সংরক্ষিত হয়।
 *    তাই migration/setup ছাড়া existing string পরিবর্তন করবেন না।
 *
 * 4. একই property name দুইটি আলাদা object-এ থাকতে পারে।
 *
 *    উদাহরণ:
 *    PLATFORM_PERMISSIONS.SUBSCRIPTION_READ
 *    COMPANY_PERMISSIONS.SUBSCRIPTION_READ
 *
 *    এতে কোনো TypeScript conflict হবে না।
 *
 * 5. Platform permission Company Owner-কে এবং Company permission
 *    Platform role-কে assign করবেন না।
 */

/**
 * ============================================================
 * PLATFORM PERMISSIONS
 * ============================================================
 *
 * এই permissions শুধুমাত্র Platform-scoped operation-এর জন্য।
 *
 * সম্ভাব্য Platform roles:
 *
 * - SUPER_ADMIN
 * - PLATFORM_ADMIN
 * - PLATFORM_STAFF
 *
 * Company Owner অথবা Company Member-কে এই permissions
 * assign করা যাবে না।
 */
export const PLATFORM_PERMISSIONS = {
  /**
   * ----------------------------------------------------------
   * PLATFORM STAFF MANAGEMENT
   * ----------------------------------------------------------
   *
   * Platform-এর internal staff account দেখা, তৈরি,
   * update, status পরিবর্তন এবং role assign করার জন্য।
   */

  // Platform staff list/details দেখা
  STAFF_READ: 'platform.staff.read',

  // নতুন Platform staff তৈরি
  STAFF_CREATE: 'platform.staff.create',

  // Platform staff information update
  STAFF_UPDATE: 'platform.staff.update',

  // Platform staff activate/deactivate/suspend
  STAFF_STATUS: 'platform.staff.status',

  // Platform staff-কে Platform role assign
  STAFF_ROLE_ASSIGN: 'platform.staff.role.assign',

  /**
   * ----------------------------------------------------------
   * PLATFORM ROLE MANAGEMENT
   * ----------------------------------------------------------
   *
   * Platform-level roles এবং role permissions manage করার জন্য।
   */

  // Platform roles দেখা
  ROLE_READ: 'platform.role.read',

  // নতুন Platform role তৈরি
  ROLE_CREATE: 'platform.role.create',

  // Platform role update
  ROLE_UPDATE: 'platform.role.update',

  // Platform role activate/deactivate
  ROLE_STATUS: 'platform.role.status',

  // Platform role-এ permission assign/remove
  ROLE_PERMISSION_ASSIGN: 'platform.role.permission.assign',

  /**
   * ----------------------------------------------------------
   * COMPANY MANAGEMENT
   * ----------------------------------------------------------
   *
   * Super Admin Platform থেকে Company account manage করবে।
   */

  // সব Company এবং Company details দেখা
  COMPANY_READ: 'platform.company.read',

  // নতুন Company তৈরি
  COMPANY_CREATE: 'platform.company.create',

  // Company information update
  COMPANY_UPDATE: 'platform.company.update',

  // Company status পরিবর্তন
  COMPANY_STATUS: 'platform.company.status',

  // Company activate/go-live করা
  COMPANY_ACTIVATE: 'platform.company.activate',

  // Company suspend করা
  COMPANY_SUSPEND: 'platform.company.suspend',

  /**
   * ----------------------------------------------------------
   * COMPANY OWNER MANAGEMENT
   * ----------------------------------------------------------
   *
   * গুরুত্বপূর্ণ:
   *
   * এই permissions Company Owner নিজে ব্যবহার করবে না।
   * Super Admin যেন Company Owner account manage করতে পারে,
   * তার জন্য এগুলো Platform permission হিসেবে রাখা হয়েছে।
   */

  // Company Owner details দেখা
  COMPANY_OWNER_READ: 'platform.company.owner.read',

  // Company Owner account তৈরি
  COMPANY_OWNER_CREATE: 'platform.company.owner.create',

  // Company Owner information update
  COMPANY_OWNER_UPDATE: 'platform.company.owner.update',

  // একটি Company-এর Owner পরিবর্তন
  COMPANY_OWNER_CHANGE: 'platform.company.owner.change',

  // Company Owner status পরিবর্তন
  COMPANY_OWNER_STATUS: 'platform.company.owner.status',

  /**
   * ----------------------------------------------------------
   * TENANT MANAGEMENT
   * ----------------------------------------------------------
   *
   * Platform থেকে Tenant lifecycle manage করার জন্য।
   */

  // নতুন Tenant তৈরি
  TENANT_CREATE: 'platform.tenant.create',

  // Tenant list/details দেখা
  TENANT_READ: 'platform.tenant.read',

  // Tenant information update
  TENANT_UPDATE: 'platform.tenant.update',

  // Tenant status পরিবর্তন
  TENANT_STATUS: 'platform.tenant.status',

  // Tenant delete করার permission
  TENANT_DELETE: 'platform.tenant.delete',

  /**
   * ----------------------------------------------------------
   * INDUSTRY MANAGEMENT
   * ----------------------------------------------------------
   *
   * Supershop, Pharmacy, Restaurant, Fashion ও Service-এর মতো
   * business industry/type manage করার জন্য।
   */

  // Industry list/details দেখা
  INDUSTRY_READ: 'platform.industry.read',

  // নতুন Industry তৈরি
  INDUSTRY_CREATE: 'platform.industry.create',

  // Industry update
  INDUSTRY_UPDATE: 'platform.industry.update',

  // Industry status পরিবর্তন
  INDUSTRY_STATUS: 'platform.industry.status',

  // Industry activate
  INDUSTRY_ACTIVATE: 'platform.industry.activate',

  // Industry deactivate
  INDUSTRY_DEACTIVATE: 'platform.industry.deactivate',

  // Industry delete
  INDUSTRY_DELETE: 'platform.industry.delete',

  /**
   * ----------------------------------------------------------
   * COMPANY RBAC BOOTSTRAP
   * ----------------------------------------------------------
   *
   * Company activation-এর সময় default Company roles,
   * permissions এবং Owner membership তৈরি করার জন্য।
   *
   * এটি Platform operation, কিন্তু existing permission string
   * 'company.rbac.bootstrap' রাখা হয়েছে।
   *
   * Database compatibility-এর জন্য value পরিবর্তন করবেন না।
   */

  COMPANY_RBAC_BOOTSTRAP: 'company.rbac.bootstrap',

  /**
   * ----------------------------------------------------------
   * PLAN PRICING MANAGEMENT
   * ----------------------------------------------------------
   *
   * Plan-এর Monthly/Yearly pricing এবং price status
   * manage করার জন্য।
   *
   * Existing permission strings অপরিবর্তিত রাখা হয়েছে।
   */

  // নতুন Plan price তৈরি
  PLAN_PRICING_CREATE: 'plan.pricing.create',

  // Plan prices দেখা
  PLAN_PRICING_READ: 'plan.pricing.read',

  // Existing Plan price update
  PLAN_PRICING_UPDATE: 'plan.pricing.update',

  // Plan price activate/deactivate
  PLAN_PRICING_STATUS: 'plan.pricing.status',

  /**
   * ----------------------------------------------------------
   * PLATFORM SUBSCRIPTION MANAGEMENT
   * ----------------------------------------------------------
   *
   * Super Admin যেন সব Company-এর subscription manage করতে পারে,
   * তার জন্য এই permissions ব্যবহার হবে।
   *
   * Existing colon-based permission strings পরিবর্তন করা হয়নি।
   *
   * উদাহরণ:
   * 'subscription:create'
   * 'subscription:read'
   */

  // Platform থেকে Company subscription তৈরি
  SUBSCRIPTION_CREATE: 'subscription:create',

  // Platform থেকে সব subscription/list/details দেখা
  SUBSCRIPTION_READ: 'subscription:read',

  // Platform override হিসেবে Auto-Renew ON/OFF টগল করা
  SUBSCRIPTION_AUTO_RENEW: 'subscription:auto-renew',

  // Platform থেকে subscription update
  SUBSCRIPTION_UPDATE: 'subscription:update',

  // Platform override হিসেবে Plan change
  SUBSCRIPTION_CHANGE_PLAN: 'subscription:change-plan',

  // Platform override হিসেবে subscription cancel
  SUBSCRIPTION_CANCEL: 'subscription:cancel',

  // Platform থেকে subscription renew
  SUBSCRIPTION_RENEW: 'subscription:renew',

  // Policy/fraud/support কারণে subscription suspend
  SUBSCRIPTION_SUSPEND: 'subscription:suspend',

  // Suspended/cancelled subscription reactivate
  SUBSCRIPTION_REACTIVATE: 'subscription:reactivate',

  SUBSCRIPTION_EXPIRE: 'subscription:expire',

  /**
   * ----------------------------------------------------------
   * FEATURE MANAGEMENT
   * ----------------------------------------------------------
   *
   * Platform features তৈরি, update, activate, deactivate
   * এবং archive করার জন্য।
   */

  // নতুন Feature তৈরি
  FEATURE_CREATE: 'platform.feature.create',

  // Feature list/details দেখা
  FEATURE_READ: 'platform.feature.read',

  // Feature update
  FEATURE_UPDATE: 'platform.feature.update',

  // Feature-এর সাধারণ status পরিবর্তন
  FEATURE_STATUS: 'platform.feature.status',

  // Feature activate
  FEATURE_ACTIVATE: 'platform.feature.activate',

  // Feature deactivate
  FEATURE_DEACTIVATE: 'platform.feature.deactivate',

  // Feature archive
  FEATURE_ARCHIVE: 'platform.feature.archive',

  BILLING_CREATE: 'billing.create',
  BILLING_READ: 'billing.read',
  BILLING_PROCESS: 'billing.process',
  BILLING_RETRY: 'billing.retry',
  BILLING_CANCEL: 'billing.cancel',
  BILLING_SKIP: 'billing.skip',
  BILLING_MARK_SUCCEEDED: 'billing.mark_succeeded',
  BILLING_MARK_FAILED: 'billing.mark_failed',

  /**
   * ----------------------------------------------------------
   * INVOICE MANAGEMENT
   * ----------------------------------------------------------
   *
   * Billing period-এর জন্য formal Invoice তৈরি, issue,
   * cancel, void এবং settle (mark-paid) করার জন্য।
   */
  INVOICE_CREATE: 'invoice.create',
  INVOICE_READ: 'invoice.read',
  INVOICE_ISSUE: 'invoice.issue',
  INVOICE_CANCEL: 'invoice.cancel',
  INVOICE_VOID: 'invoice.void',
  INVOICE_MARK_PAID: 'invoice.mark_paid',

  /**
   * ----------------------------------------------------------
   * PAYMENT MANAGEMENT
   * ----------------------------------------------------------
   *
   * Gateway payment attempt দেখা, manual re-verify/reconcile
   * এবং cancel করার জন্য। Payment creation Platform-এর কাজ নয় —
   * সেটা Company-side action (নিচে COMPANY_PERMISSIONS দেখুন)।
   */
  PAYMENT_READ: 'payment.read',
  PAYMENT_VERIFY: 'payment.verify',
  PAYMENT_CANCEL: 'payment.cancel',

  /**
   * ----------------------------------------------------------
   * PLAN MANAGEMENT
   * ----------------------------------------------------------
   *
   * Plan তৈরি, update, status পরিবর্তন এবং archive করার জন্য।
   */

  // Plan list/details দেখা
  PLAN_READ: 'platform.plan.read',

  // নতুন Plan তৈরি
  PLAN_CREATE: 'platform.plan.create',

  // Plan information update
  PLAN_UPDATE: 'platform.plan.update',

  // Plan status পরিবর্তন
  PLAN_STATUS: 'platform.plan.status',

  // Plan archive করা
  PLAN_ARCHIVE: 'platform.plan.archive',

  /**
   * ----------------------------------------------------------
   * PLAN FEATURE MANAGEMENT
   * ----------------------------------------------------------
   *
   * একটি Plan-এর সাথে Feature assign/update/remove করার জন্য।
   */

  // Plan-এ assigned feature দেখা
  PLAN_FEATURE_READ: 'platform.plan.feature.read',

  // Plan-এ নতুন feature assign করা
  PLAN_FEATURE_ASSIGN: 'platform.plan.feature.assign',

  // Plan feature assignment update
  PLAN_FEATURE_UPDATE: 'platform.plan.feature.update',

  // Plan থেকে feature remove করা
  PLAN_FEATURE_REMOVE: 'platform.plan.feature.remove',
} as const;

/**
 * ============================================================
 * COMPANY PERMISSIONS
 * ============================================================
 *
 * এই permissions Company context-এর ভিতরে ব্যবহার হবে।
 *
 * সম্ভাব্য Company roles:
 *
 * - COMPANY_OWNER
 * - MANAGER
 * - CASHIER
 * - STOREKEEPER
 * - ACCOUNTANT
 *
 * CompanyPermissionsGuard permission check করার পাশাপাশি
 * x-company-id এবং membership/company isolation verify করবে।
 */
export const COMPANY_PERMISSIONS = {
  /**
   * ----------------------------------------------------------
   * COMPANY RBAC MANAGEMENT
   * ----------------------------------------------------------
   *
   * Company Owner যেন নিজের Company-এর roles এবং permissions
   * manage করতে পারে, তার জন্য।
   */

  // Company roles এবং permissions দেখা
  RBAC_READ: 'company.rbac.read',

  // নতুন custom Company role তৈরি
  ROLE_CREATE: 'company.role.create',

  // Company role update
  ROLE_UPDATE: 'company.role.update',

  // Company role-এ permission assign/remove
  ROLE_PERMISSION_ASSIGN: 'company.role.permission.assign',

  /**
   * ----------------------------------------------------------
   * COMPANY MEMBER MANAGEMENT
   * ----------------------------------------------------------
   *
   * Company Owner/authorized Manager যেন নিজের Company-এর
   * members manage করতে পারে, তার জন্য।
   */

  // Company members list/details দেখা
  MEMBER_READ: 'company.member.read',

  // নতুন Company member তৈরি/invite
  MEMBER_CREATE: 'company.member.create',

  // Company member update
  MEMBER_UPDATE: 'company.member.update',

  // Company member-কে role assign/remove
  MEMBER_ROLE_ASSIGN: 'company.member.role.assign',

  // Branch/Warehouse/Scope assign
  MEMBER_SCOPE_ASSIGN: 'company.member.scope.assign',

  /**
   * ----------------------------------------------------------
   * COMPANY SUBSCRIPTION MANAGEMENT
   * ----------------------------------------------------------
   *
   * Company Owner যেন শুধু নিজের Company-এর subscription
   * দেখতে ও manage করতে পারে, তার জন্য।
   *
   * এগুলো Platform permission নয়।
   *
   * Company Owner অন্য Company-এর subscription access করতে
   * পারবে না। CompanyContextGuard/CompanyPermissionsGuard
   * দিয়ে company isolation enforce করতে হবে।
   */

  // নিজের Company-এর current subscription/history/details দেখা
  SUBSCRIPTION_READ: 'company.subscription.read',

  // নিজের Company-এর auto-renew চালু/বন্ধ করা
  SUBSCRIPTION_AUTO_RENEW: 'company.subscription.auto-renew',

  // নিজের Company-এর subscription Plan change করা
  SUBSCRIPTION_CHANGE_PLAN: 'company.subscription.change-plan',

  // নিজের Company-এর subscription cancel করা
  SUBSCRIPTION_CANCEL: 'company.subscription.cancel',

  // নিজের Company-এর cancelled subscription reactivate করা
  SUBSCRIPTION_REACTIVATE: 'company.subscription.reactivate',

  /**
   * ----------------------------------------------------------
   * COMPANY INVOICE (READ-ONLY)
   * ----------------------------------------------------------
   *
   * Company Owner/authorized role যেন শুধু নিজের Company-এর
   * invoice দেখতে পারে — issue/cancel/void/mark-paid সবই
   * Platform-controlled, Company-side কোনো mutation নেই।
   */
  INVOICE_READ: 'company.invoice.read',

  /**
   * ----------------------------------------------------------
   * COMPANY PAYMENT
   * ----------------------------------------------------------
   *
   * Paying একটি customer-initiated action — তাই Invoice-এর মতো
   * read-only নয়, Company-side এখানে create permission-ও আছে।
   */
  PAYMENT_CREATE: 'company.payment.create',

  PAYMENT_READ: 'company.payment.read',

  /**
   * ----------------------------------------------------------
   * COMPANY BUSINESS OPS — MASTER DATA
   * ----------------------------------------------------------
   *
   * Business Operations module (Sales/Purchase/Inventory)-এর ভিত্তি —
   * Location, Category, Unit, Product, Customer, Supplier, এবং
   * প্রতিটা Company-র নিজস্ব Settings/configuration toggle।
   */
  LOCATION_READ: 'company.location.read',
  LOCATION_CREATE: 'company.location.create',
  LOCATION_UPDATE: 'company.location.update',

  CATEGORY_READ: 'company.category.read',
  CATEGORY_CREATE: 'company.category.create',
  CATEGORY_UPDATE: 'company.category.update',

  UNIT_READ: 'company.unit.read',
  UNIT_CREATE: 'company.unit.create',
  UNIT_UPDATE: 'company.unit.update',

  PRODUCT_READ: 'company.product.read',
  PRODUCT_CREATE: 'company.product.create',
  PRODUCT_UPDATE: 'company.product.update',

  CUSTOMER_READ: 'company.customer.read',
  CUSTOMER_CREATE: 'company.customer.create',
  CUSTOMER_UPDATE: 'company.customer.update',

  SUPPLIER_READ: 'company.supplier.read',
  SUPPLIER_CREATE: 'company.supplier.create',
  SUPPLIER_UPDATE: 'company.supplier.update',

  SETTINGS_READ: 'company.settings.read',
  SETTINGS_UPDATE: 'company.settings.update',

  /**
   * ----------------------------------------------------------
   * COMPANY BUSINESS OPS — PURCHASE + STOCK TRANSFER
   * ----------------------------------------------------------
   */
  PURCHASE_ORDER_READ: 'company.purchase-order.read',
  PURCHASE_ORDER_CREATE: 'company.purchase-order.create',
  PURCHASE_ORDER_UPDATE: 'company.purchase-order.update',
  PURCHASE_ORDER_CANCEL: 'company.purchase-order.cancel',
  PURCHASE_ORDER_RECEIVE: 'company.purchase-order.receive',

  PURCHASE_RETURN_READ: 'company.purchase-return.read',
  PURCHASE_RETURN_CREATE: 'company.purchase-return.create',

  STOCK_TRANSFER_READ: 'company.stock-transfer.read',
  STOCK_TRANSFER_CREATE: 'company.stock-transfer.create',
  STOCK_TRANSFER_DISPATCH: 'company.stock-transfer.dispatch',
  STOCK_TRANSFER_RECEIVE: 'company.stock-transfer.receive',

  SUPPLIER_PAYMENT_READ: 'company.supplier-payment.read',
  SUPPLIER_PAYMENT_CREATE: 'company.supplier-payment.create',

  /**
   * ----------------------------------------------------------
   * COMPANY BUSINESS OPS — SALES / POS
   * ----------------------------------------------------------
   *
   * VOID/RETURN ইচ্ছাকৃতভাবে SALE_CREATE থেকে আলাদা permission —
   * শুধু Owner/Manager-এর হাতে থাকবে (document Section ৫.৫,
   * decision #2), Cashier শুধু নতুন Sale করতে পারবে।
   */
  SALE_READ: 'company.sale.read',
  SALE_CREATE: 'company.sale.create',
  SALE_VOID: 'company.sale.void',

  SALE_RETURN_READ: 'company.sale-return.read',
  SALE_RETURN_CREATE: 'company.sale-return.create',

  CUSTOMER_PAYMENT_READ: 'company.customer-payment.read',
  CUSTOMER_PAYMENT_CREATE: 'company.customer-payment.create',

  /**
   * Cash Drawer / Day-Close (Phase 5). OPEN/CLOSE kept separate from each
   * other (not just READ vs write) since they're distinct real-world
   * actions performed at different moments of a shift — same trust-tier
   * reasoning as SALE_VOID being separate from SALE_CREATE.
   */
  CASH_DRAWER_SESSION_READ: 'company.cash-drawer-session.read',
  CASH_DRAWER_SESSION_OPEN: 'company.cash-drawer-session.open',
  CASH_DRAWER_SESSION_CLOSE: 'company.cash-drawer-session.close',

  /**
   * Reporting (Phase 6). PROFIT_REPORT_READ is kept separate from
   * REPORT_READ — margin/profit visibility is a classic case an Owner
   * wants hidden from a Branch Manager even while everything else in
   * REPORT_READ stays visible to them.
   */
  REPORT_READ: 'company.report.read',
  PROFIT_REPORT_READ: 'company.profit-report.read',
} as const;

/**
 * ============================================================
 * PERMISSION TYPES
 * ============================================================
 *
 * PLATFORM_PERMISSIONS এবং COMPANY_PERMISSIONS-এর values থেকে
 * TypeScript automatically valid permission-code union তৈরি করবে।
 *
 * এর ফলে decorator-এ invalid raw string দিলে compile-time error হবে।
 *
 * সঠিক:
 *
 * @RequirePlatformPermissions(
 *   PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
 * )
 *
 * ভুল:
 *
 * @RequirePlatformPermissions('UNKNOWN_PERMISSION')
 */

/**
 * Platform permission values-এর TypeScript union।
 */
export type PlatformPermissionCode =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

/**
 * Company permission values-এর TypeScript union।
 */
export type CompanyPermissionCode =
  (typeof COMPANY_PERMISSIONS)[keyof typeof COMPANY_PERMISSIONS];

// export const PLATFORM_PERMISSIONS = {
//   // Platform Staff
//   STAFF_READ: 'platform.staff.read',
//   STAFF_CREATE: 'platform.staff.create',
//   STAFF_UPDATE: 'platform.staff.update',
//   STAFF_STATUS: 'platform.staff.status',
//   STAFF_ROLE_ASSIGN: 'platform.staff.role.assign',

//   // Platform Roles
//   ROLE_READ: 'platform.role.read',
//   ROLE_UPDATE: 'platform.role.update',
//   ROLE_PERMISSION_ASSIGN: 'platform.role.permission.assign',

//   // Company Management
//   COMPANY_READ: 'platform.company.read',
//   COMPANY_CREATE: 'platform.company.create',
//   COMPANY_UPDATE: 'platform.company.update',
//   COMPANY_STATUS: 'platform.company.status',
//   COMPANY_ACTIVATE: 'platform.company.activate',
//   COMPANY_SUSPEND: 'platform.company.suspend',

//   /**
//    * Company Owner Management
//    */
//   COMPANY_OWNER_READ:
//     'platform.company.owner.read',

//   COMPANY_OWNER_CREATE:
//     'platform.company.owner.create',

//   COMPANY_OWNER_UPDATE:
//     'platform.company.owner.update',

//   COMPANY_OWNER_CHANGE:
//     'platform.company.owner.change',

//   COMPANY_OWNER_STATUS:
//     'platform.company.owner.status',

//   // Tanant ManageMent---

//   TENANT_CREATE: 'platform.tenant.create',

//   TENANT_READ: 'platform.tenant.read',

//   TENANT_UPDATE: 'platform.tenant.update',

//   TENANT_STATUS: 'platform.tenant.status',

//   TENANT_DELETE: 'platform.tenant.delete',

//   // Industry Management
//   INDUSTRY_READ: 'platform.industry.read',
//   INDUSTRY_CREATE: 'platform.industry.create',
//   INDUSTRY_UPDATE: 'platform.industry.update',
//   INDUSTRY_STATUS: 'platform.industry.status',
//   INDUSTRY_ACTIVATE: 'platform.industry.activate',
//   INDUSTRY_DEACTIVATE: 'platform.industry.deactivate',
//   INDUSTRY_DELETE: 'platform.industry.delete',
//   // Company RBAC Bootstrap
//   COMPANY_RBAC_BOOTSTRAP: 'company.rbac.bootstrap',

//   // plane Price
// PLAN_PRICING_CREATE:
//   'plan.pricing.create',

// PLAN_PRICING_READ:
//   'plan.pricing.read',

// PLAN_PRICING_UPDATE:
//   'plan.pricing.update',

// PLAN_PRICING_STATUS:
//   'plan.pricing.status',

//   SUBSCRIPTION_CREATE: 'subscription:create',
//   SUBSCRIPTION_READ: 'subscription:read',
//   SUBSCRIPTION_UPDATE: 'subscription:update',
//   SUBSCRIPTION_CHANGE_PLAN: 'subscription:change-plan',
//   SUBSCRIPTION_CANCEL: 'subscription:cancel',
//   SUBSCRIPTION_RENEW: 'subscription:renew',
//   SUBSCRIPTION_SUSPEND: 'subscription:suspend',
//   SUBSCRIPTION_REACTIVATE: 'subscription:reactivate',

//  // Feature Management
// FEATURE_CREATE: 'platform.feature.create',
// FEATURE_READ: 'platform.feature.read',
// FEATURE_UPDATE: 'platform.feature.update',
// FEATURE_STATUS: 'platform.feature.status',
// FEATURE_ACTIVATE: 'platform.feature.activate',
// FEATURE_DEACTIVATE: 'platform.feature.deactivate',
// FEATURE_ARCHIVE: 'platform.feature.archive',
// SUBSCRIPTION_MANAGE: "platform.subscription.manage",

// } as const;

// export const COMPANY_PERMISSIONS = {
//   RBAC_READ: 'company.rbac.read',
//   ROLE_CREATE: 'company.role.create',
//   ROLE_UPDATE: 'company.role.update',
//   ROLE_PERMISSION_ASSIGN: 'company.role.permission.assign',
//   MEMBER_READ: 'company.member.read',
//   MEMBER_CREATE: 'company.member.create',
//   MEMBER_UPDATE: 'company.member.update',
//   MEMBER_ROLE_ASSIGN: 'company.member.role.assign',
//   MEMBER_SCOPE_ASSIGN: 'company.member.scope.assign',
// } as const;

// export type PlatformPermissionCode =
//   (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

// export type CompanyPermissionCode =
//   (typeof COMPANY_PERMISSIONS)[keyof typeof COMPANY_PERMISSIONS];
