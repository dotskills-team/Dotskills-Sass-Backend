import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Vercel's zero-config NestJS support (docs: vercel.com/docs/frameworks/backend/nestjs)
 * statically scans this exact file for a direct `@nestjs/core` import to
 * detect the entrypoint — it must live here, not behind a re-exported
 * helper, or the scan fails with "No entrypoint found which imports
 * nestjs" even though the file is otherwise found by name. Vercel then
 * wraps this same `app.listen()` call into one Vercel Function itself —
 * no custom serverless handler or vercel.json needed.
 */
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

// dotskills-sass-backend/
// │
// ├── prisma/
// │   │
// │   ├── schema.prisma
// │   ├── prisma.config.ts
// │   ├── phase-1.config.ts
// │   │
// │   ├── migrations/
// │   │   ├── 2026xxxxxxxx_initial/
// │   │   ├── 20260810045809_002_access_control_completion/
// │   │   └── ...
// │   │
// │   └── seed/
// │       ├── seed.ts
// │       ├── platform/
// │       ├── permissions/
// │       ├── roles/
// │       └── business-modules/
// │
// ├── src/
// │   │
// │   ├── main.ts
// │   ├── app.module.ts
// │   │
// │   ├── config/
// │   │   ├── app.config.ts
// │   │   ├── auth.config.ts
// │   │   ├── database.config.ts
// │   │   ├── redis.config.ts
// │   │   ├── security.config.ts
// │   │   └── index.ts
// │   │
// │   ├── database/
// │   │   ├── prisma.module.ts
// │   │   └── prisma.service.ts
// │   │
// │   ├── generated/
// │   │   └── phase-1-prisma/
// │   │
// │   ├── common/
// │   │   │
// │   │   ├── constants/
// │   │   │   ├── app.constants.ts
// │   │   │   ├── auth.constants.ts
// │   │   │   ├── permission.constants.ts
// │   │   │   ├── role.constants.ts
// │   │   │   └── module.constants.ts
// │   │   │
// │   │   ├── decorators/
// │   │   │   ├── auth-user.decorator.ts
// │   │   │   ├── permissions.decorator.ts
// │   │   │   ├── public.decorator.ts
// │   │   │   ├── roles.decorator.ts
// │   │   │   ├── company-context.decorator.ts
// │   │   │   └── tenant-context.decorator.ts
// │   │   │
// │   │   ├── guards/
// │   │   │   ├── access-token.guard.ts
// │   │   │   ├── permission.guard.ts
// │   │   │   ├── platform-permission.guard.ts
// │   │   │   ├── company-permission.guard.ts
// │   │   │   ├── company-context.guard.ts
// │   │   │   ├── tenant-context.guard.ts
// │   │   │   ├── module-access.guard.ts
// │   │   │   └── scope.guard.ts
// │   │   │
// │   │   ├── interceptors/
// │   │   │   ├── request-context.interceptor.ts
// │   │   │   ├── audit.interceptor.ts
// │   │   │   └── logging.interceptor.ts
// │   │   │
// │   │   ├── filters/
// │   │   │   ├── http-exception.filter.ts
// │   │   │   └── prisma-exception.filter.ts
// │   │   │
// │   │   ├── pipes/
// │   │   │   ├── validation.pipe.ts
// │   │   │   └── parse-uuid.pipe.ts
// │   │   │
// │   │   ├── middleware/
// │   │   │   ├── request-id.middleware.ts
// │   │   │   └── tenant.middleware.ts
// │   │   │
// │   │   ├── types/
// │   │   │   ├── authenticated-user.type.ts
// │   │   │   ├── company-context.type.ts
// │   │   │   ├── tenant-context.type.ts
// │   │   │   ├── permission.type.ts
// │   │   │   └── pagination.type.ts
// │   │   │
// │   │   └── utils/
// │   │       ├── pagination.util.ts
// │   │       ├── password.util.ts
// │   │       ├── date.util.ts
// │   │       └── response.util.ts
// │   │
// │   └── modules/
// │       │
// │       ├── auth/
// │       │   ├── auth.module.ts
// │       │   ├── auth.controller.ts
// │       │   ├── auth.service.ts
// │       │   │
// │       │   ├── dto/
// │       │   │   ├── login.dto.ts
// │       │   │   ├── refresh-token.dto.ts
// │       │   │   └── logout.dto.ts
// │       │   │
// │       │   ├── guards/
// │       │   ├── strategies/
// │       │   └── types/
// │       │
// │       ├── identity/
// │       │   ├── users/
// │       │   ├── sessions/
// │       │   └── identity.module.ts
// │       │
// │       ├── access-control/
// │       │   │
// │       │   ├── platform/
// │       │   │   ├── platform-rbac/
// │       │   │   ├── platform-staff/
// │       │   │   ├── platform-roles/
// │       │   │   ├── platform-permissions/
// │       │   │   └── access-control-setup/
// │       │   │
// │       │   ├── company/
// │       │   │   ├── company-rbac/
// │       │   │   ├── company-roles/
// │       │   │   ├── company-permissions/
// │       │   │   ├── company-members/
// │       │   │   └── company-scopes/
// │       │   │
// │       │   └── access-control.module.ts
// │       │
// │       ├── tenant/
// │       │   ├── tenant.module.ts
// │       │   ├── tenant.controller.ts
// │       │   ├── tenant.service.ts
// │       │   └── dto/
// │       │
// │       ├── company/
// │       │   ├── company.module.ts
// │       │   ├── company.controller.ts
// │       │   ├── company.service.ts
// │       │   │
// │       │   ├── dto/
// │       │   │   ├── create-company.dto.ts
// │       │   │   ├── update-company.dto.ts
// │       │   │   └── company-query.dto.ts
// │       │   │
// │       │   ├── types/
// │       │   └── policies/
// │       │
// │       ├── platform/
// │       │   │
// │       │   ├── dashboard/
// │       │   │   ├── dashboard.module.ts
// │       │   │   ├── dashboard.controller.ts
// │       │   │   ├── dashboard.service.ts
// │       │   │   └── dto/
// │       │   │
// │       │   ├── companies/
// │       │   │   ├── companies.module.ts
// │       │   │   ├── companies.controller.ts
// │       │   │   ├── companies.service.ts
// │       │   │   │
// │       │   │   ├── dto/
// │       │   │   │   ├── create-company.dto.ts
// │       │   │   │   ├── update-company.dto.ts
// │       │   │   │   ├── company-query.dto.ts
// │       │   │   │   └── company-status.dto.ts
// │       │   │   │
// │       │   │   └── types/
// │       │   │
// │       │   ├── packages/
// │       │   │   ├── packages.module.ts
// │       │   │   ├── packages.controller.ts
// │       │   │   ├── packages.service.ts
// │       │   │   │
// │       │   │   ├── dto/
// │       │   │   ├── package-features/
// │       │   │   ├── package-limits/
// │       │   │   └── package-modules/
// │       │   │
// │       │   ├── subscriptions/
// │       │   │   ├── subscriptions.module.ts
// │       │   │   ├── subscriptions.controller.ts
// │       │   │   ├── subscriptions.service.ts
// │       │   │   │
// │       │   │   ├── dto/
// │       │   │   ├── renewal/
// │       │   │   ├── extension/
// │       │   │   ├── grace-period/
// │       │   │   └── cancellation/
// │       │   │
// │       │   ├── company-activation/
// │       │   │   ├── company-activation.module.ts
// │       │   │   ├── company-activation.controller.ts
// │       │   │   ├── company-activation.service.ts
// │       │   │   └── validators/
// │       │   │
// │       │   ├── addons/
// │       │   │   ├── addons.module.ts
// │       │   │   ├── addons.controller.ts
// │       │   │   ├── addons.service.ts
// │       │   │   └── dto/
// │       │   │
// │       │   ├── modules/
// │       │   │   ├── modules.module.ts
// │       │   │   ├── modules.controller.ts
// │       │   │   ├── modules.service.ts
// │       │   │   └── dto/
// │       │   │
// │       │   ├── audit/
// │       │   │   ├── audit.module.ts
// │       │   │   ├── audit.controller.ts
// │       │   │   ├── audit.service.ts
// │       │   │   └── dto/
// │       │   │
// │       │   └── settings/
// │       │       ├── settings.module.ts
// │       │       ├── settings.controller.ts
// │       │       ├── settings.service.ts
// │       │       └── dto/
// │       │
// │       └── business/
// │           │
// │           ├── core/
// │           │   │
// │           │   ├── branches/
// │           │   ├── outlets/
// │           │   ├── warehouses/
// │           │   ├── pos/
// │           │   ├── employees/
// │           │   ├── customers/
// │           │   ├── suppliers/
// │           │   ├── products/
// │           │   ├── categories/
// │           │   ├── brands/
// │           │   ├── units/
// │           │   ├── inventory/
// │           │   ├── purchases/
// │           │   ├── sales/
// │           │   ├── payments/
// │           │   ├── expenses/
// │           │   └── reports/
// │           │
// │           ├── super-shop/
// │           │   ├── super-shop.module.ts
// │           │   ├── promotions/
// │           │   ├── discounts/
// │           │   ├── price-rules/
// │           │   ├── loyalty/
// │           │   └── reports/
// │           │
// │           ├── pharmacy/
// │           │   ├── pharmacy.module.ts
// │           │   ├── medicines/
// │           │   ├── generics/
// │           │   ├── dosage-forms/
// │           │   ├── strengths/
// │           │   ├── batches/
// │           │   ├── expiry/
// │           │   ├── prescriptions/
// │           │   ├── drug-schedules/
// │           │   └── reports/
// │           │
// │           ├── restaurant/
// │           │   ├── restaurant.module.ts
// │           │   ├── menus/
// │           │   ├── menu-items/
// │           │   ├── recipes/
// │           │   ├── ingredients/
// │           │   ├── modifiers/
// │           │   ├── tables/
// │           │   ├── kitchens/
// │           │   ├── kitchen-orders/
// │           │   ├── orders/
// │           │   ├── delivery/
// │           │   └── reports/
// │           │
// │           ├── fashion/
// │           │   ├── fashion.module.ts
// │           │   ├── collections/
// │           │   ├── variants/
// │           │   ├── sizes/
// │           │   ├── colors/
// │           │   ├── attributes/
// │           │   ├── style-codes/
// │           │   ├── seasonal-products/
// │           │   └── reports/
// │           │
// │           └── service-business/
// │               ├── service-business.module.ts
// │               ├── services/
// │               ├── service-categories/
// │               ├── bookings/
// │               ├── appointments/
// │               ├── schedules/
// │               ├── staff-schedules/
// │               ├── invoices/
// │               └── reports/
// │
// ├── test/
// │   ├── unit/
// │   ├── integration/
// │   └── e2e/
// │
// ├── .env
// ├── .env.example
// ├── .gitignore
// ├── nest-cli.json
// ├── package.json
// ├── tsconfig.json
// ├── tsconfig.build.json
// └── README.md
