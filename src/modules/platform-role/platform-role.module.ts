import { Module } from '@nestjs/common';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import {
  PlatformPermissionController,
  PlatformRoleController,
} from './platform-role.controller';
import { PlatformRoleService } from './platform-role.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PlatformPermissionController, PlatformRoleController],
  providers: [PlatformRoleService, PlatformPermissionsGuard],
  exports: [PlatformRoleService],
})
export class PlatformRoleModule {}
