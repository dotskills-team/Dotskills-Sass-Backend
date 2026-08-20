import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { IndustryService } from './industry.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

import { CreateIndustryDto } from './dto/create-industry.dto';
import { IndustryQueryDto } from './dto/industry-query.dto';
import { UpdateIndustryDto } from './dto/update-industry.dto';
import { UpdateIndustryStatusDto } from './dto/update-industry-status.dto';

import { PLATFORM_PERMISSIONS } from 'src/common/constants/permission.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformPermissionsGuard } from 'src/common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from 'src/common/decorators/require-platform-permissions.decorator';

@Controller('platform/industries')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class IndustryController {
  constructor(private readonly industryService: IndustryService) {}

  /**
   * CREATE INDUSTRY
   *
   * POST /api/v1/platform/industries
   */
  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INDUSTRY_CREATE)
  async create(@Body() dto: CreateIndustryDto, @Req() req: Request) {
    return this.industryService.create(
      dto,
      this.getUserId(req),
      this.getRequestId(req),
      this.getIpAddress(req),
      this.getUserAgent(req),
    );
  }

  /**
   * GET ALL INDUSTRIES
   *
   * GET /api/v1/platform/industries
   *
   * Query:
   * ?search=shop
   * &status=ACTIVE
   * &page=1
   * &limit=20
   * &sortBy=name
   * &sortOrder=asc
   */
  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INDUSTRY_READ)
  async findAll(@Query() query: IndustryQueryDto) {
    return this.industryService.findAll(query);
  }

  /**
   * GET SINGLE INDUSTRY
   *
   * GET /api/v1/platform/industries/:id
   */
  @Get(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INDUSTRY_READ)
  async findOne(@Param('id') id: string) {
    return this.industryService.findOne(id);
  }

  /**
   * UPDATE INDUSTRY
   *
   * PATCH /api/v1/platform/industries/:id
   */
  @Patch(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INDUSTRY_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIndustryDto,
    @Req() req: Request,
  ) {
    return this.industryService.update(
      id,
      dto,
      this.getUserId(req),
      this.getRequestId(req),
      this.getIpAddress(req),
      this.getUserAgent(req),
    );
  }

  /**
   * ACTIVATE INDUSTRY
   *
   * PATCH /api/v1/platform/industries/:id/activate
   */
  @Patch(':id/activate')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INDUSTRY_ACTIVATE)
  async activate(@Param('id') id: string, @Req() req: Request) {
    return this.industryService.activate(
      id,
      this.getUserId(req),
      this.getRequestId(req),
      this.getIpAddress(req),
      this.getUserAgent(req),
    );
  }

  /**
   * DEACTIVATE INDUSTRY
   *
   * PATCH /api/v1/platform/industries/:id/deactivate
   */
  @Patch(':id/deactivate')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INDUSTRY_DEACTIVATE)
  async deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.industryService.deactivate(
      id,
      this.getUserId(req),
      this.getRequestId(req),
      this.getIpAddress(req),
      this.getUserAgent(req),
    );
  }

  /**
   * GENERIC STATUS UPDATE
   *
   * PATCH /api/v1/platform/industries/:id/status
   *
   * This endpoint is useful when the platform
   * needs controlled status transitions.
   */
  @Patch(':id/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INDUSTRY_STATUS)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIndustryStatusDto,
    @Req() req: Request,
  ) {
    return this.industryService.updateStatus(
      id,
      dto,
      this.getUserId(req),
      this.getRequestId(req),
      this.getIpAddress(req),
      this.getUserAgent(req),
    );
  }

  /**
   * SOFT DELETE / ARCHIVE INDUSTRY
   *
   * PATCH /api/v1/platform/industries/:id/archive
   */
  @Patch(':id/archive')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.INDUSTRY_DELETE)
  async archive(@Param('id') id: string, @Req() req: Request) {
    return this.industryService.archive(
      id,
      this.getUserId(req),
      this.getRequestId(req),
      this.getIpAddress(req),
      this.getUserAgent(req),
    );
  }

  /**
   * ================================
   * Request Metadata Helpers
   * ================================
   */

  private getUserId(req: Request): string | undefined {
    const user = req.user as AuthenticatedUser | undefined;

    return user?.userId;
  }

  private getRequestId(req: Request): string | undefined {
    const requestId = req.headers['x-request-id'];

    if (Array.isArray(requestId)) {
      return requestId[0];
    }

    return requestId;
  }

  private getIpAddress(req: Request): string | undefined {
    return req.ip;
  }

  private getUserAgent(req: Request): string | undefined {
    return req.get('user-agent');
  }
}
