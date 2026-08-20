import { Module } from '@nestjs/common';
import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { CompanyScopeGuard } from '../../common/guards/company-scope.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import {
  CompanyRbacBootstrapController,
  CompanyRbacController,
} from './company-rbac.controller';
import { CompanyRbacService } from './company-rbac.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CompanyRbacBootstrapController, CompanyRbacController],
  providers: [
    CompanyRbacService,
    CompanyContextGuard,
    CompanyPermissionsGuard,
    CompanyScopeGuard,
    PlatformPermissionsGuard,
  ],
  exports: [CompanyRbacService, CompanyScopeGuard],
})
export class CompanyRbacModule {}
