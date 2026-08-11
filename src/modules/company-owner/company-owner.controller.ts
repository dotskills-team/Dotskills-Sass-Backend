import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CompanyOwnerService } from './company-owner.service';

import { CreateCompanyOwnerDto } from './dto/create-company-owner.dto';
import { UpdateCompanyOwnerDto } from './dto/update-company-owner.dto';
import { UpdateCompanyOwnerStatusDto } from './dto/update-company-owner-status.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';

@Controller('platform/companies/:companyId/owner')
@UseGuards(
  JwtAuthGuard,
  PlatformPermissionsGuard,
)
export class CompanyOwnerController {
  constructor(
    private readonly ownerService: CompanyOwnerService,
  ) {}

  /**
   * Create / assign owner
   *
   * POST
   * /api/v1/platform/companies/:companyId/owner
   */
  @Post()
  @RequirePlatformPermissions(
    'platform.company.owner.create',
  )
  create(
    @Param('companyId', ParseUUIDPipe)
    companyId: string,

    @Body() dto: CreateCompanyOwnerDto,

    @Req() req: any,
  ) {
    /**
     * URL companyId is authoritative.
     * Prevent body tampering.
     */
    dto.companyId = companyId;

    return this.ownerService.create(
      dto,
      req.user.userId,
    );
  }

  /**
   * Get all owners
   *
   * GET
   * /api/v1/platform/companies/:companyId/owner
   */
  @Get()
  @RequirePlatformPermissions(
    'platform.company.owner.read',
  )
  findAll(
    @Param('companyId', ParseUUIDPipe)
    companyId: string,
  ) {
    return this.ownerService.findAll(companyId);
  }

  /**
   * Get single owner
   *
   * GET
   * /api/v1/platform/companies/:companyId/owner/:ownerMemberId
   */
  @Get(':ownerMemberId')
  @RequirePlatformPermissions(
    'platform.company.owner.read',
  )
  findOne(
    @Param('companyId', ParseUUIDPipe)
    companyId: string,

    @Param('ownerMemberId', ParseUUIDPipe)
    ownerMemberId: string,
  ) {
    return this.ownerService.findOne(
      companyId,
      ownerMemberId,
    );
  }

  /**
   * Update owner profile
   *
   * PATCH
   * /api/v1/platform/companies/:companyId/owner/:ownerMemberId
   */
  @Patch(':ownerMemberId')
  @RequirePlatformPermissions(
    'platform.company.owner.update',
  )
  update(
    @Param('companyId', ParseUUIDPipe)
    companyId: string,

    @Param('ownerMemberId', ParseUUIDPipe)
    ownerMemberId: string,

    @Body() dto: UpdateCompanyOwnerDto,

    @Req() req: any,
  ) {
    return this.ownerService.update(
      companyId,
      ownerMemberId,
      dto,
      req.user.userId,
    );
  }

  /**
   * Change primary owner
   *
   * PUT
   * /api/v1/platform/companies/:companyId/owner/:ownerMemberId/primary
   */
  @Post(':ownerMemberId/primary')
  @RequirePlatformPermissions(
    'platform.company.owner.change',
  )
  changeOwner(
    @Param('companyId', ParseUUIDPipe)
    companyId: string,

    @Param('ownerMemberId', ParseUUIDPipe)
    ownerMemberId: string,

    @Req() req: any,
  ) {
    return this.ownerService.changeOwner(
      companyId,
      ownerMemberId,
      req.user.userId,
    );
  }

  /**
   * Update owner status
   *
   * PATCH
   * /api/v1/platform/companies/:companyId/owner/:ownerMemberId/status
   */
  @Patch(':ownerMemberId/status')
  @RequirePlatformPermissions(
    'platform.company.owner.status',
  )
  updateStatus(
    @Param('companyId', ParseUUIDPipe)
    companyId: string,

    @Param('ownerMemberId', ParseUUIDPipe)
    ownerMemberId: string,

    @Body() dto: UpdateCompanyOwnerStatusDto,

    @Req() req: any,
  ) {
    return this.ownerService.updateStatus(
      companyId,
      ownerMemberId,
      dto,
      req.user.userId,
    );
  }
}