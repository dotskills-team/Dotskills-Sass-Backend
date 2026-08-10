// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';

// @Module({
//   imports: [],
//   controllers: [AppController],
//   providers: [AppService],
// })
// export class AppModule {}
// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
// import { HealthModule } from './health/health.module';
// import { PrismaModule } from './prisma/prisma.module';

// @Module({
//   imports: [
//     PrismaModule,
//     HealthModule,
//   ],
//   controllers: [AppController],
//   providers: [AppService],
// })
// export class AppModule {}



import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';

// import { PlatformRbacModule } from './modules/platform-rbac/platform-rbac.module';
import { AccessControlSetupModule } from './modules/access-control-setup/access-control-setup.module';
import { PlatformStaffModule } from './modules/platform-staff/platform-staff.module';
import { CompanyRbacModule } from './modules/company-rbac/company-rbac.module';
import { PlatformRbacModule } from './modules/demoplatform-rbac/platform-rbac.module';
import { CompanyManagementModule } from './modules/company-management/company-management.module';
import { CompanyOwnerModule } from './modules/company-owner/company-owner.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    AuthModule,
    PlatformRbacModule,
    AccessControlSetupModule,
    PlatformStaffModule,
    CompanyRbacModule,
    CompanyManagementModule,
        CompanyOwnerModule,


  ],
  controllers: [AppController],
})
export class AppModule {}


