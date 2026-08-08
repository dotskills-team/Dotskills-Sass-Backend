// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();
import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();












// folder structure 
// dotskills-sass-backend/
// │
// ├── prisma/                                      # 🗄️ Prisma + PostgreSQL database layer
// │   │
// │   ├── migrations/                              # 🔄 Database migration history
// │   │                                             # Schema change-এর version history
// │   │
// │   ├── seed.ts                                  # 🌱 Initial/seed data
// │   │                                             # Roles, permissions, plans, demo data
// │   │
// │   └── schema.prisma                            # 🧩 Complete database schema
// │                                                 # User, Company, Customer, Product etc.
// │
// ├── src/
// │   │
// │   ├── config/                                  # ⚙️ Application configuration
// │   │
// │   │   ├── app.config.ts                        # App settings
// │   │                                             # PORT, API prefix, environment
// │   │
// │   │   ├── database.config.ts                   # 🗄️ Database configuration
// │   │                                             # Database-related settings
// │   │
// │   │   ├── auth.config.ts                       # 🔐 Authentication configuration
// │   │                                             # JWT/token/cookie settings
// │   │
// │   │   └── env.validation.ts                    # ✅ Environment validation
// │                                                 # DATABASE_URL, JWT secrets etc.
// │
// │   ├── common/                                  # 🧰 Shared application infrastructure
// │   │                                             # কোনো specific business module-এর না
// │   │
// │   │   ├── constants/                           # 📌 Shared constant values
// │   │                                             # API limits, messages, keys etc.
// │   │
// │   │   ├── decorators/                          # 🏷️ Custom NestJS decorators
// │   │                                             # @CurrentUser(), @CurrentCompany()
// │   │
// │   │   ├── enums/                               # 🔤 Shared enums
// │   │                                             # UserStatus, CompanyStatus etc.
// │   │
// │   │   ├── exceptions/                          # ❌ Custom business exceptions
// │   │
// │   │   ├── filters/                             # 🚨 Global exception filters
// │   │                                             # সব API error consistent করবে
// │   │
// │   │   ├── guards/                              # 🛡️ Global authorization/security guards
// │   │                                             # Authentication/RBAC/Tenant guards
// │   │
// │   │   ├── interceptors/                        # 🔄 Request/response interceptors
// │   │                                             # Logging/response processing
// │   │
// │   │   ├── middleware/                          # 🔧 Global/custom middleware
// │   │                                             # Request processing
// │   │
// │   │   ├── pipes/                               # 🧪 Validation/transformation
// │   │                                             # DTO validation
// │   │
// │   │   ├── serializers/                         # 📦 Response serialization
// │   │                                             # Sensitive field hide/format
// │   │
// │   │   ├── types/                               # 📝 Shared TypeScript types
// │   │
// │   │   └── utils/                               # 🔨 Reusable helper functions
// │   │                                             # Date, pagination, slug etc.
// │
// │   ├── prisma/                                  # 🔌 NestJS ↔ Prisma integration
// │   │
// │   │   ├── prisma.module.ts                     # Prisma NestJS module
// │   │                                             # PrismaService provide/export করবে
// │   │
// │   │   └── prisma.service.ts                    # 🗄️ Central PrismaService
// │                                                 # PostgreSQL access করবে
// │
// │   ├── modules/                                 # 🧩 Business feature modules
// │   │                                             # Feature-based architecture
// │   │
// │   │   ├── auth/                                # 🔐 Authentication
// │   │   │   ├── dto/                             # Login/Register DTO
// │   │   │   ├── guards/                          # Auth-specific guards
// │   │   │   ├── strategies/                      # JWT authentication strategies
// │   │   │   ├── auth.controller.ts               # Auth API endpoints
// │   │   │   ├── auth.service.ts                  # Login/Register business logic
// │   │   │   └── auth.module.ts                   # Auth module
// │   │
// │   │   ├── users/                               # 👤 User management
// │   │   │   ├── dto/                             # Create/update user DTO
// │   │   │   ├── users.controller.ts              # User API
// │   │   │   ├── users.service.ts                 # User business logic
// │   │   │   └── users.module.ts                  # User module
// │   │
// │   │   ├── companies/                           # 🏢 Tenant/company management
// │   │   │   ├── dto/                             # Company DTO
// │   │   │   ├── companies.controller.ts          # Company API
// │   │   │   ├── companies.service.ts             # Company business logic
// │   │   │   └── companies.module.ts              # Company module
// │   │
// │   │   ├── memberships/                         # 👥 User ↔ Company relationship
// │   │   │   ├── dto/                             # Membership DTO
// │   │   │   ├── memberships.controller.ts        # Membership API
// │   │   │   ├── memberships.service.ts           # Membership logic
// │   │   │   └── memberships.module.ts            # Membership module
// │   │
// │   │   ├── roles/                               # 🎭 Role management
// │   │   │   ├── dto/                             # Role DTO
// │   │   │   ├── roles.controller.ts              # Role API
// │   │   │   ├── roles.service.ts                 # Role logic
// │   │   │   └── roles.module.ts                  # Role module
// │   │
// │   │   ├── permissions/                         # 🔑 Permission management
// │   │   │   ├── dto/                             # Permission DTO
// │   │   │   ├── permissions.controller.ts        # Permission API
// │   │   │   ├── permissions.service.ts           # Permission logic
// │   │   │   └── permissions.module.ts            # Permission module
// │   │
// │   │   ├── subscriptions/                       # 💳 SaaS subscription
// │   │   │   ├── dto/                             # Subscription DTO
// │   │   │   ├── subscriptions.controller.ts     # Subscription API
// │   │   │   ├── subscriptions.service.ts        # Subscription logic
// │   │   │   └── subscriptions.module.ts         # Subscription module
// │   │
// │   │   ├── customers/                           # 👨‍💼 Customer management
// │   │   │   ├── dto/                             # Customer DTO
// │   │   │   ├── customers.controller.ts          # Customer API
// │   │   │   ├── customers.service.ts             # Customer logic
// │   │   │   └── customers.module.ts              # Customer module
// │   │
// │   │   ├── products/                            # 📦 Product management
// │   │   │   ├── dto/                             # Product DTO
// │   │   │   ├── products.controller.ts          # Product API
// │   │   │   ├── products.service.ts             # Product logic
// │   │   │   └── products.module.ts              # Product module
// │   │
// │   │   ├── categories/                          # 🗂️ Category management
// │   │   │   ├── dto/                             # Category DTO
// │   │   │   ├── categories.controller.ts        # Category API
// │   │   │   ├── categories.service.ts           # Category logic
// │   │   │   └── categories.module.ts            # Category module
// │   │
// │   │   ├── sales/                               # 🛒 Sales/order management
// │   │   │   ├── dto/
// │   │   │   ├── sales.controller.ts
// │   │   │   ├── sales.service.ts
// │   │   │   └── sales.module.ts
// │   │
// │   │   ├── purchases/                           # 🧾 Purchase management
// │   │   │   ├── dto/
// │   │   │   ├── purchases.controller.ts
// │   │   │   ├── purchases.service.ts
// │   │   │   └── purchases.module.ts
// │   │
// │   │   ├── inventory/                           # 📊 Inventory/stock management
// │   │   │   ├── dto/
// │   │   │   ├── inventory.controller.ts
// │   │   │   ├── inventory.service.ts
// │   │   │   └── inventory.module.ts
// │   │
// │   │   ├── payments/                            # 💰 Payment/transaction management
// │   │   │   ├── dto/
// │   │   │   ├── payments.controller.ts
// │   │   │   ├── payments.service.ts
// │   │   │   └── payments.module.ts
// │   │
// │   │   ├── expenses/                            # 💸 Business expense management
// │   │   │   ├── dto/
// │   │   │   ├── expenses.controller.ts
// │   │   │   ├── expenses.service.ts
// │   │   │   └── expenses.module.ts
// │   │
// │   │   ├── accounting/                          # 📚 Accounting/financial records
// │   │   │   ├── dto/
// │   │   │   ├── accounting.controller.ts
// │   │   │   ├── accounting.service.ts
// │   │   │   └── accounting.module.ts
// │   │
// │   │   ├── reports/                             # 📈 Reports & analytics
// │   │   │   ├── dto/
// │   │   │   ├── reports.controller.ts
// │   │   │   ├── reports.service.ts
// │   │   │   └── reports.module.ts
// │   │
// │   │   ├── notifications/                       # 🔔 Notifications
// │   │   │   ├── dto/
// │   │   │   ├── notifications.controller.ts
// │   │   │   ├── notifications.service.ts
// │   │   │   └── notifications.module.ts
// │   │
// │   │   ├── files/                               # 📁 File/document management
// │   │   │   ├── dto/
// │   │   │   ├── files.controller.ts
// │   │   │   ├── files.service.ts
// │   │   │   └── files.module.ts
// │   │
// │   │   └── audit-logs/                          # 📝 Audit trail
// │   │       ├── dto/
// │   │       ├── audit-logs.controller.ts
// │   │       ├── audit-logs.service.ts
// │   │       └── audit-logs.module.ts
// │   │
// │   ├── health/                                  # ❤️ Health monitoring
// │   │   ├── health.controller.ts                 # GET /api/v1/health
// │   │   └── health.module.ts
// │   │
// │   ├── app.module.ts                            # 🏠 Root NestJS module
// │   │                                             # সব modules এখানে register/import
// │   │
// │   └── main.ts                                  # 🚀 Application bootstrap
// │                                                 # CORS, ValidationPipe,
// │                                                 # API version/prefix, Swagger etc.
// │
// ├── test/                                        # 🧪 Automated testing
// │   │
// │   ├── unit/                                    # Individual service/function tests
// │   │
// │   └── integration/                             # API + DB integration tests
// │
// ├── .env                                         # 🔐 Local secrets/config
// │                                                 # ❌ GitHub-এ commit করবে না
// │
// ├── .env.example                                 # 📋 Environment variable template
// │                                                 # ✅ GitHub-এ রাখা যাবে
// │
// ├── .gitignore                                   # 🚫 Ignored files
// │                                                 # node_modules, .env etc.
// │
// ├── prisma.config.ts                             # ⚙️ Prisma 7 configuration
// │                                                 # Schema + migrations + DATABASE_URL
// │
// ├── package.json                                 # 📦 Dependencies + scripts
// │
// ├── tsconfig.json                                # 🟦 TypeScript configuration
// │
// ├── nest-cli.json                                # 🐱 NestJS CLI configuration
// │
// └── README.md                                    # 📖 Project documentation