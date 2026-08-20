import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { TenantManagementService } from './tenant-management.service';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';

@Controller('platform/tenants')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class TenantManagementController {
  constructor(private readonly tenantService: TenantManagementService) {}

  /**
   * CREATE TENANT
   *
   * POST
   * /api/v1/platform/tenants
   */
  @Post()
  @RequirePlatformPermissions('platform.tenant.create')
  create(@Body() dto: CreateTenantDto, @Req() req: any) {
    return this.tenantService.create(dto, req.user.userId);
  }

  /**
   * GET ALL TENANTS
   *
   * GET
   * /api/v1/platform/tenants
   */
  @Get()
  @RequirePlatformPermissions('platform.tenant.read')
  findAll(@Query() query: TenantQueryDto) {
    return this.tenantService.findAll(query);
  }

  /**
   * GET SINGLE TENANT
   *
   * GET
   * /api/v1/platform/tenants/:id
   */
  @Get(':id')
  @RequirePlatformPermissions('platform.tenant.read')
  findOne(
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.tenantService.findOne(id);
  }

  /**
   * UPDATE TENANT
   *
   * PATCH
   * /api/v1/platform/tenants/:id
   */
  @Patch(':id')
  @RequirePlatformPermissions('platform.tenant.update')
  update(
    @Param('id', ParseUUIDPipe)
    id: string,

    @Body() dto: UpdateTenantDto,

    @Req() req: any,
  ) {
    return this.tenantService.update(id, dto, req.user.userId);
  }

  /**
   * UPDATE TENANT STATUS
   *
   * PATCH
   * /api/v1/platform/tenants/:id/status
   */
  @Patch(':id/status')
  @RequirePlatformPermissions('platform.tenant.status')
  updateStatus(
    @Param('id', ParseUUIDPipe)
    id: string,

    @Body() dto: UpdateTenantStatusDto,

    @Req() req: any,
  ) {
    return this.tenantService.updateStatus(id, dto, req.user.userId);
  }

  /**
   * CANCEL TENANT
   *
   * DELETE
   * /api/v1/platform/tenants/:id
   *
   * IMPORTANT:
   * This does NOT physically delete the row.
   * It changes status -> CANCELLED.
   */
  @Delete(':id')
  @RequirePlatformPermissions('platform.tenant.delete')
  remove(
    @Param('id', ParseUUIDPipe)
    id: string,

    @Req() req: any,
  ) {
    return this.tenantService.remove(id, req.user.userId);
  }
}
