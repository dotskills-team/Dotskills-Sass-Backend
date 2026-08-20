import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { DevelopmentOnlyGuard } from './guards/development-only.guard';
import { PlatformRbacService } from './platform-rbac.service';

@Controller('platform-rbac')
@UseGuards(DevelopmentOnlyGuard)
export class PlatformRbacController {
  constructor(private readonly platformRbacService: PlatformRbacService) {}

  @Get('seed-status')
  getSeedStatus() {
    return this.platformRbacService.getSeedStatus();
  }

  @Get('permissions')
  getPermissions() {
    return this.platformRbacService.getPermissions();
  }

  @Get('roles')
  getRoles() {
    return this.platformRbacService.getRoles();
  }

  @Get('roles/:code')
  getRoleByCode(@Param('code') code: string) {
    return this.platformRbacService.getRoleByCode(code);
  }

  @Get('super-admin')
  getSuperAdmin() {
    return this.platformRbacService.getSuperAdmin();
  }
}
