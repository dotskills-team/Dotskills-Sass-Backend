// import 'dotenv/config';
// import * as bcrypt from 'bcrypt';

// import { PrismaPg } from '@prisma/adapter-pg';
// import {
//   BillingCycle,
//   PrismaClient,
// } from '../src/generated/phase-1-prisma/client';

// const databaseUrl = process.env.DATABASE_URL;
// const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
// const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
// const superAdminFullName = process.env.SUPER_ADMIN_FULL_NAME;

// if (!databaseUrl) {
//   throw new Error('DATABASE_URL is missing in .env');
// }

// if (!superAdminEmail) {
//   throw new Error('SUPER_ADMIN_EMAIL is missing in .env');
// }

// if (!superAdminPassword) {
//   throw new Error('SUPER_ADMIN_PASSWORD is missing in .env');
// }

// if (!superAdminFullName) {
//   throw new Error('SUPER_ADMIN_FULL_NAME is missing in .env');
// }

// const adapter = new PrismaPg({
//   connectionString: databaseUrl,
// });

// const prisma = new PrismaClient({
//   adapter,
// });

// const industries = [
//   {
//     code: 'SUPERSHOP',
//     name: 'Supershop',
//     description: 'Retail supershop and grocery business',
//   },
//   {
//     code: 'PHARMACY',
//     name: 'Pharmacy',
//     description: 'Pharmacy and medicine retail business',
//   },
//   {
//     code: 'FASHION',
//     name: 'Fashion',
//     description: 'Clothing and fashion retail business',
//   },
//   {
//     code: 'RESTAURANT',
//     name: 'Restaurant',
//     description: 'Restaurant and food service business',
//   },
//   {
//     code: 'SERVICE',
//     name: 'Service',
//     description: 'Service-based business',
//   },
// ];

// const features = [
//   {
//     code: 'DASHBOARD',
//     name: 'Dashboard',
//     module: 'CORE',
//     description: 'Business dashboard and summary',
//   },
//   {
//     code: 'COMPANY_MANAGEMENT',
//     name: 'Company Management',
//     module: 'CORE',
//     description: 'Company profile and configuration',
//   },
//   {
//     code: 'USER_MANAGEMENT',
//     name: 'User Management',
//     module: 'IAM',
//     description: 'Company users and role management',
//   },
//   {
//     code: 'INVENTORY',
//     name: 'Inventory',
//     module: 'INVENTORY',
//     description: 'Inventory and stock management',
//   },
//   {
//     code: 'PURCHASE',
//     name: 'Purchase',
//     module: 'PURCHASE',
//     description: 'Purchase and supplier operations',
//   },
//   {
//     code: 'SALES_POS',
//     name: 'Sales and POS',
//     module: 'SALES',
//     description: 'Sales and point-of-sale operations',
//   },
//   {
//     code: 'BASIC_REPORTS',
//     name: 'Basic Reports',
//     module: 'REPORTS',
//     description: 'Standard business reports',
//   },
//   {
//     code: 'ADVANCED_REPORTS',
//     name: 'Advanced Reports',
//     module: 'REPORTS',
//     description: 'Advanced business reports and analytics',
//   },
// ];

// async function seedPlatformRole() {
//   return prisma.platformRole.upsert({
//     where: {
//       code: 'SUPER_ADMIN',
//     },
//     update: {
//       name: 'Super Admin',
//       description: 'Full platform administration access',
//       status: 'ACTIVE',
//     },
//     create: {
//       code: 'SUPER_ADMIN',
//       name: 'Super Admin',
//       description: 'Full platform administration access',
//       status: 'ACTIVE',
//     },
//   });
// }

// async function seedSuperAdmin(platformRoleId: string) {
//   const passwordHash = await bcrypt.hash(superAdminPassword!, 12);
//   const now = new Date();

//   const user = await prisma.user.upsert({
//     where: {
//       email: superAdminEmail!,
//     },
//     update: {
//       fullName: superAdminFullName!,
//       passwordHash,
//       status: 'ACTIVE',
//       emailVerifiedAt: now,
//       passwordChangedAt: now,
//       deletedAt: null,
//     },
//     create: {
//       email: superAdminEmail!,
//       fullName: superAdminFullName!,
//       passwordHash,
//       preferredLocale: 'bn-BD',
//       timezone: 'Asia/Dhaka',
//       status: 'ACTIVE',
//       emailVerifiedAt: now,
//       passwordChangedAt: now,
//     },
//   });

//   const platformMember = await prisma.platformMember.upsert({
//     where: {
//       userId: user.id,
//     },
//     update: {
//       status: 'ACTIVE',
//       activatedAt: now,
//     },
//     create: {
//       userId: user.id,
//       employeeCode: 'SA-001',
//       status: 'ACTIVE',
//       invitedAt: now,
//       activatedAt: now,
//     },
//   });

//   await prisma.platformMemberRole.upsert({
//     where: {
//       platformMemberId_platformRoleId: {
//         platformMemberId: platformMember.id,
//         platformRoleId,
//       },
//     },
//     update: {},
//     create: {
//       platformMemberId: platformMember.id,
//       platformRoleId,
//       assignedByUserId: user.id,
//     },
//   });

//   return user;
// }

// async function seedIndustries() {
//   for (const industry of industries) {
//     await prisma.industry.upsert({
//       where: {
//         code: industry.code,
//       },
//       update: {
//         name: industry.name,
//         description: industry.description,
//         status: 'ACTIVE',
//       },
//       create: {
//         ...industry,
//         status: 'ACTIVE',
//       },
//     });
//   }
// }

// async function seedFeatures() {
//   const seededFeatures = new Map<string, string>();

//   for (const feature of features) {
//     const savedFeature = await prisma.feature.upsert({
//       where: {
//         code: feature.code,
//       },
//       update: {
//         name: feature.name,
//         module: feature.module,
//         description: feature.description,
//         status: 'ACTIVE',
//       },
//       create: {
//         ...feature,
//         status: 'ACTIVE',
//       },
//     });

//     seededFeatures.set(savedFeature.code, savedFeature.id);
//   }

//   return seededFeatures;
// }

// async function seedPlans(featureIds: Map<string, string>) {
//   const basicPlan = await prisma.plan.upsert({
//     where: {
//       code: 'BASIC',
//     },
//     update: {
//       name: 'Basic',
//       description: 'Basic package for small businesses',
//       trialDays: 14,
//       isPublic: true,
//       status: 'ACTIVE',
//     },
//     create: {
//       code: 'BASIC',
//       name: 'Basic',
//       description: 'Basic package for small businesses',
//       trialDays: 14,
//       isPublic: true,
//       status: 'ACTIVE',
//     },
//   });

//   const proPlan = await prisma.plan.upsert({
//     where: {
//       code: 'PRO',
//     },
//     update: {
//       name: 'Pro',
//       description: 'Professional package for growing businesses',
//       trialDays: 14,
//       isPublic: true,
//       status: 'ACTIVE',
//     },
//     create: {
//       code: 'PRO',
//       name: 'Pro',
//       description: 'Professional package for growing businesses',
//       trialDays: 14,
//       isPublic: true,
//       status: 'ACTIVE',
//     },
//   });

//   const effectiveFrom = new Date('2026-01-01T00:00:00.000Z');

//   const prices = [
//     {
//       planId: basicPlan.id,
//       billingCycle: BillingCycle.MONTHLY,
//       amount: '999.0000',
//     },
//     {
//       planId: basicPlan.id,
//       billingCycle: BillingCycle.YEARLY,
//       amount: '9990.0000',
//     },
//     {
//       planId: proPlan.id,
//       billingCycle: BillingCycle.MONTHLY,
//       amount: '2499.0000',
//     },
//     {
//       planId: proPlan.id,
//       billingCycle: BillingCycle.YEARLY,
//       amount: '24990.0000',
//     },
//   ];

//   for (const price of prices) {
//     await prisma.planPrice.upsert({
//       where: {
//         planId_billingCycle_currencyCode_effectiveFrom: {
//           planId: price.planId,
//           billingCycle: price.billingCycle,
//           currencyCode: 'BDT',
//           effectiveFrom,
//         },
//       },
//       update: {
//         amount: price.amount,
//         isActive: true,
//         effectiveTo: null,
//       },
//       create: {
//         planId: price.planId,
//         billingCycle: price.billingCycle,
//         currencyCode: 'BDT',
//         amount: price.amount,
//         effectiveFrom,
//         isActive: true,
//       },
//     });
//   }

//   const basicFeatures = [
//     'DASHBOARD',
//     'COMPANY_MANAGEMENT',
//     'USER_MANAGEMENT',
//     'INVENTORY',
//     'PURCHASE',
//     'SALES_POS',
//     'BASIC_REPORTS',
//   ];

//   for (const featureCode of basicFeatures) {
//     const featureId = featureIds.get(featureCode);

//     if (!featureId) {
//       throw new Error(`Feature not found: ${featureCode}`);
//     }

//     await prisma.planFeature.upsert({
//       where: {
//         planId_featureId: {
//           planId: basicPlan.id,
//           featureId,
//         },
//       },
//       update: {
//         enabled: true,
//         limits: {
//           maxUsers: 5,
//           maxBranches: 1,
//         },
//       },
//       create: {
//         planId: basicPlan.id,
//         featureId,
//         enabled: true,
//         limits: {
//           maxUsers: 5,
//           maxBranches: 1,
//         },
//       },
//     });
//   }

//   for (const feature of features) {
//     const featureId = featureIds.get(feature.code);

//     if (!featureId) {
//       throw new Error(`Feature not found: ${feature.code}`);
//     }

//     await prisma.planFeature.upsert({
//       where: {
//         planId_featureId: {
//           planId: proPlan.id,
//           featureId,
//         },
//       },
//       update: {
//         enabled: true,
//         limits: {
//           maxUsers: 25,
//           maxBranches: 5,
//         },
//       },
//       create: {
//         planId: proPlan.id,
//         featureId,
//         enabled: true,
//         limits: {
//           maxUsers: 25,
//           maxBranches: 5,
//         },
//       },
//     });
//   }
// }

// async function main() {
//   console.log('Starting Phase-1 database seed...');

//   const platformRole = await seedPlatformRole();
//   const superAdmin = await seedSuperAdmin(platformRole.id);

//   await seedIndustries();

//   const featureIds = await seedFeatures();

//   await seedPlans(featureIds);

//   console.log('Phase-1 database seed completed successfully.');
//   console.log(`Super Admin: ${superAdmin.email}`);
// }

// main()
//   .catch((error: unknown) => {
//     console.error('Database seed failed:', error);
//     process.exitCode = 1;
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  BillingCycle,
  Prisma,
  PrismaClient,
} from '../src/generated/phase-1-prisma/client';
import { hashPassword } from '../src/common/utils/password.util';
import { seedPermissions } from './seeds/seed-permissions';
import { seedPlatformRoles } from './seeds/seed-platform-roles';

// import { seedPermissions } from './seeds/seed-permissions';
// import { seedPlatformRoles } from './seeds/seed-platform-roles';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is missing in .env`);
  }

  return value;
}

const databaseUrl: string = getRequiredEnv('DATABASE_URL');
const superAdminEmail: string = getRequiredEnv('SUPER_ADMIN_EMAIL');
const superAdminPassword: string = getRequiredEnv(
  'SUPER_ADMIN_PASSWORD',
);
const superAdminFullName: string = getRequiredEnv(
  'SUPER_ADMIN_FULL_NAME',
);




const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

const industries = [
  {
    code: 'SUPERSHOP',
    name: 'Supershop',
    description: 'Retail supershop and grocery business',
  },
  {
    code: 'PHARMACY',
    name: 'Pharmacy',
    description: 'Pharmacy and medicine retail business',
  },
  {
    code: 'FASHION',
    name: 'Fashion',
    description: 'Clothing and fashion retail business',
  },
  {
    code: 'RESTAURANT',
    name: 'Restaurant',
    description: 'Restaurant and food service business',
  },
  {
    code: 'SERVICE',
    name: 'Service',
    description: 'Service-based business',
  },
];

interface SeedFeatureConfigField {
  key: string;
  label: string;
  description?: string;
  type: 'NUMBER' | 'BOOLEAN' | 'STRING' | 'SELECT' | 'MULTI_SELECT';
  required?: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
}

interface SeedFeature {
  code: string;
  name: string;
  module: string;
  description: string;
  configSchema?: SeedFeatureConfigField[];
}

const features: SeedFeature[] = [
  {
    code: 'DASHBOARD',
    name: 'Dashboard',
    module: 'CORE',
    description: 'Business dashboard and summary',
  },
  {
    code: 'COMPANY_MANAGEMENT',
    name: 'Company Management',
    module: 'CORE',
    description: 'Company profile and configuration',
  },
  {
    code: 'USER_MANAGEMENT',
    name: 'User Management',
    module: 'IAM',
    description: 'Company users and role management',
    configSchema: [
      {
        key: 'maxUsers',
        label: 'Maximum Users',
        description: 'Maximum number of company users allowed on this plan.',
        type: 'NUMBER',
        required: true,
        defaultValue: 5,
        min: 1,
        max: 1000,
      },
      {
        key: 'allowImport',
        label: 'Allow Import',
        description: 'Let the company bulk-import users from a spreadsheet.',
        type: 'BOOLEAN',
        defaultValue: false,
      },
    ],
  },
  {
    code: 'INVENTORY',
    name: 'Inventory',
    module: 'INVENTORY',
    description: 'Inventory and stock management',
  },
  {
    code: 'PURCHASE',
    name: 'Purchase',
    module: 'PURCHASE',
    description: 'Purchase and supplier operations',
  },
  {
    code: 'SALES_POS',
    name: 'Sales and POS',
    module: 'SALES',
    description: 'Sales and point-of-sale operations',
  },
  {
    code: 'BASIC_REPORTS',
    name: 'Basic Reports',
    module: 'REPORTS',
    description: 'Standard business reports',
  },
  {
    code: 'ADVANCED_REPORTS',
    name: 'Advanced Reports',
    module: 'REPORTS',
    description: 'Advanced business reports and analytics',
  },
];

async function seedSuperAdmin(platformRoleId: string) {
  const passwordHash: string = await hashPassword(superAdminPassword);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: {
      email: superAdminEmail,
    },
    update: {
      fullName: superAdminFullName,
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: now,
      passwordChangedAt: now,
      deletedAt: null,
    },
    create: {
      email: superAdminEmail,
      fullName: superAdminFullName,
      passwordHash,
      preferredLocale: 'bn-BD',
      timezone: 'Asia/Dhaka',
      status: 'ACTIVE',
      emailVerifiedAt: now,
      passwordChangedAt: now,
    },
  });

  const platformMember = await prisma.platformMember.upsert({
    where: {
      userId: user.id,
    },
    update: {
      status: 'ACTIVE',
      activatedAt: now,
    },
    create: {
      userId: user.id,
      employeeCode: 'SA-001',
      status: 'ACTIVE',
      invitedAt: now,
      activatedAt: now,
    },
  });

  await prisma.platformMemberRole.upsert({
    where: {
      platformMemberId_platformRoleId: {
        platformMemberId: platformMember.id,
        platformRoleId,
      },
    },
    update: {},
    create: {
      platformMemberId: platformMember.id,
      platformRoleId,
      assignedByUserId: user.id,
    },
  });

  return user;
}

async function seedIndustries(): Promise<void> {
  for (const industry of industries) {
    await prisma.industry.upsert({
      where: {
        code: industry.code,
      },
      update: {
        name: industry.name,
        description: industry.description,
        status: 'ACTIVE',
      },
      create: {
        ...industry,
        status: 'ACTIVE',
      },
    });
  }

  console.log(`Seeded ${industries.length} industries.`);
}

async function seedFeatures(): Promise<Map<string, string>> {
  const seededFeatures = new Map<string, string>();

  for (const feature of features) {
    const savedFeature = await prisma.feature.upsert({
      where: {
        code: feature.code,
      },
      update: {
        name: feature.name,
        module: feature.module,
        description: feature.description,
        status: 'ACTIVE',
        configSchema: feature.configSchema
          ? (feature.configSchema as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      create: {
        ...feature,
        configSchema: feature.configSchema
          ? (feature.configSchema as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        status: 'ACTIVE',
      },
    });

    seededFeatures.set(savedFeature.code, savedFeature.id);
  }

  console.log(`Seeded ${features.length} features.`);

  return seededFeatures;
}

async function seedPlans(
  featureIds: Map<string, string>,
): Promise<void> {
  const basicPlan = await prisma.plan.upsert({
    where: {
      code: 'BASIC',
    },
    update: {
      name: 'Basic',
      description: 'Basic package for small businesses',
      trialDays: 14,
      isPublic: true,
      status: 'ACTIVE',
    },
    create: {
      code: 'BASIC',
      name: 'Basic',
      description: 'Basic package for small businesses',
      trialDays: 14,
      isPublic: true,
      status: 'ACTIVE',
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: {
      code: 'PRO',
    },
    update: {
      name: 'Pro',
      description: 'Professional package for growing businesses',
      trialDays: 14,
      isPublic: true,
      status: 'ACTIVE',
    },
    create: {
      code: 'PRO',
      name: 'Pro',
      description: 'Professional package for growing businesses',
      trialDays: 14,
      isPublic: true,
      status: 'ACTIVE',
    },
  });

  const effectiveFrom = new Date('2026-01-01T00:00:00.000Z');

  const prices = [
    {
      planId: basicPlan.id,
      billingCycle: BillingCycle.MONTHLY,
      amount: '999.0000',
    },
    {
      planId: basicPlan.id,
      billingCycle: BillingCycle.YEARLY,
      amount: '9990.0000',
    },
    {
      planId: proPlan.id,
      billingCycle: BillingCycle.MONTHLY,
      amount: '2499.0000',
    },
    {
      planId: proPlan.id,
      billingCycle: BillingCycle.YEARLY,
      amount: '24990.0000',
    },
  ];

  for (const price of prices) {
    await prisma.planPrice.upsert({
      where: {
        planId_billingCycle_currencyCode_effectiveFrom: {
          planId: price.planId,
          billingCycle: price.billingCycle,
          currencyCode: 'BDT',
          effectiveFrom,
        },
      },
      update: {
        amount: price.amount,
        isActive: true,
        effectiveTo: null,
      },
      create: {
        planId: price.planId,
        billingCycle: price.billingCycle,
        currencyCode: 'BDT',
        amount: price.amount,
        effectiveFrom,
        isActive: true,
      },
    });
  }

  const basicFeatures = [
    'DASHBOARD',
    'COMPANY_MANAGEMENT',
    'USER_MANAGEMENT',
    'INVENTORY',
    'PURCHASE',
    'SALES_POS',
    'BASIC_REPORTS',
  ];

  for (const featureCode of basicFeatures) {
    const featureId = featureIds.get(featureCode);

    if (!featureId) {
      throw new Error(`Feature not found: ${featureCode}`);
    }

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: basicPlan.id,
          featureId,
        },
      },
      update: {
        enabled: true,
        limits: {
          maxUsers: 5,
          maxBranches: 1,
        },
      },
      create: {
        planId: basicPlan.id,
        featureId,
        enabled: true,
        limits: {
          maxUsers: 5,
          maxBranches: 1,
        },
      },
    });
  }

  for (const feature of features) {
    const featureId = featureIds.get(feature.code);

    if (!featureId) {
      throw new Error(`Feature not found: ${feature.code}`);
    }

    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: proPlan.id,
          featureId,
        },
      },
      update: {
        enabled: true,
        limits: {
          maxUsers: 25,
          maxBranches: 5,
        },
      },
      create: {
        planId: proPlan.id,
        featureId,
        enabled: true,
        limits: {
          maxUsers: 25,
          maxBranches: 5,
        },
      },
    });
  }

  console.log('Seeded BASIC and PRO plans with prices and features.');
}

async function main(): Promise<void> {
  console.log('Starting Phase-1 database seed...');

  // Permission প্রথমে তৈরি করতে হবে
  await seedPermissions(prisma);

  // তারপর roles এবং role-permission mappings
  await seedPlatformRoles(prisma);

  const superAdminRole = await prisma.platformRole.findUnique({
    where: {
      code: 'SUPER_ADMIN',
    },
    select: {
      id: true,
    },
  });

  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN platform role was not created.');
  }

  // Super Admin user তৈরি এবং SUPER_ADMIN role assign
  const superAdmin = await seedSuperAdmin(superAdminRole.id);

  await seedIndustries();

  const featureIds = await seedFeatures();

  await seedPlans(featureIds);

  console.log('Phase-1 database seed completed successfully.');
  console.log(`Super Admin: ${superAdmin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });