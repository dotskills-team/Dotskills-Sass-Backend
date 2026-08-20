import { PLATFORM_PERMISSIONS } from '../../../src/common/constants/permission.constants';
import {
  PLATFORM_ADMIN_PERMISSION_CODES,
  SUPER_ADMIN_PERMISSION_CODES,
} from '../../../src/common/constants/permission-catalog';

export type PlatformRoleDefinition = {
  code: string;
  name: string;
  description: string;
  permissionCodes: readonly string[];
};

/**
 * এই role catalog আগে নিজস্ব, হাতে-লেখা permission code (যেমন
 * 'company.create', 'subscription.assign', 'support.read') ব্যবহার
 * করত — যেগুলো runtime-এ ব্যবহৃত `permission.constants.ts`-এর সাথে
 * মিলত না (real code হলো 'platform.company.create', 'subscription:create'
 * ইত্যাদি)। এখন SUPER_ADMIN ও PLATFORM_ADMIN — এই দুটো role (যেগুলো
 * `access-control-setup` runtime bootstrap-ও touch করে) সেই একই
 * canonical code list থেকে আসে, যাতে `prisma db seed` কখনো
 * `access-control-setup`-এর assign করা permission মুছে না ফেলে।
 *
 * SALES_MANAGER/FINANCE_MANAGER/SUPPORT_MANAGER/COMPLIANCE_OFFICER/
 * AUDITOR/PLATFORM_STAFF — এই ৬টা role `access-control-setup` touch
 * করে না, কিন্তু এদেরও এখন শুধু বাস্তবে-বিদ্যমান PLATFORM_PERMISSIONS
 * code ব্যবহার করা হচ্ছে। আগে এদের কিছু permission (support.*, audit.*)
 * `permission.constants.ts`-এ কোনোভাবেই সংজ্ঞায়িত নেই — সেগুলো বাদ
 * দেওয়া হয়েছে (নতুন permission invent করা হয়নি)।
 */
export const PLATFORM_ROLE_CATALOG: PlatformRoleDefinition[] = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Complete administrative access to the DotSkills platform.',
    permissionCodes: SUPER_ADMIN_PERMISSION_CODES,
  },
  {
    code: 'PLATFORM_ADMIN',
    name: 'Platform Admin',
    description: 'Manages platform staff, companies, and subscriptions.',
    permissionCodes: PLATFORM_ADMIN_PERMISSION_CODES,
  },
  {
    code: 'SALES_MANAGER',
    name: 'Sales Manager',
    description: 'Manages company onboarding and subscription assignment.',
    permissionCodes: [
      PLATFORM_PERMISSIONS.COMPANY_CREATE,
      PLATFORM_PERMISSIONS.COMPANY_READ,
      PLATFORM_PERMISSIONS.COMPANY_UPDATE,
      PLATFORM_PERMISSIONS.SUBSCRIPTION_CREATE,
      PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
      PLATFORM_PERMISSIONS.SUBSCRIPTION_UPDATE,
      PLATFORM_PERMISSIONS.BILLING_READ,
    ],
  },
  {
    code: 'FINANCE_MANAGER',
    name: 'Finance Manager',
    description: 'Manages billing and collections.',
    permissionCodes: [
      PLATFORM_PERMISSIONS.COMPANY_READ,
      PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
      PLATFORM_PERMISSIONS.BILLING_READ,
      PLATFORM_PERMISSIONS.BILLING_PROCESS,
    ],
  },
  {
    code: 'SUPPORT_MANAGER',
    name: 'Support Manager',
    description: 'Read-only access for customer support operations.',
    permissionCodes: [
      PLATFORM_PERMISSIONS.COMPANY_READ,
      PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
    ],
  },
  {
    code: 'COMPLIANCE_OFFICER',
    name: 'Compliance Officer',
    description: 'Monitors companies, subscriptions, and billing.',
    permissionCodes: [
      PLATFORM_PERMISSIONS.STAFF_READ,
      PLATFORM_PERMISSIONS.ROLE_READ,
      PLATFORM_PERMISSIONS.COMPANY_READ,
      PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
      PLATFORM_PERMISSIONS.BILLING_READ,
    ],
  },
  {
    code: 'AUDITOR',
    name: 'Auditor',
    description: 'Read-only access to business information.',
    permissionCodes: [
      PLATFORM_PERMISSIONS.STAFF_READ,
      PLATFORM_PERMISSIONS.ROLE_READ,
      PLATFORM_PERMISSIONS.COMPANY_READ,
      PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
      PLATFORM_PERMISSIONS.BILLING_READ,
    ],
  },
  {
    code: 'PLATFORM_STAFF',
    name: 'Platform Staff',
    description: 'Basic platform staff role with limited read access.',
    permissionCodes: [
      PLATFORM_PERMISSIONS.COMPANY_READ,
      PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
    ],
  },
];
