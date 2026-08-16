import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { FeatureService } from './feature.service';

import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { UpdateFeatureStatusDto } from './dto/update-feature-status.dto';
import { QueryFeatureDto } from './dto/query-feature.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';

@Controller('platform/features')
@UseGuards(
  JwtAuthGuard,
  PlatformPermissionsGuard,
)
export class FeatureController {
  constructor(
    private readonly featureService: FeatureService,
  ) {}

  // CREATE
  @Post()
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.FEATURE_CREATE,
  )
  create(
    @Body() dto: CreateFeatureDto,
    @Req() req: any,
  ) {
    return this.featureService.create(
      dto,
      {
        actorUserId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
      },
    );
  }

  // GET ALL
  @Get()
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.FEATURE_READ,
  )
  findAll(
    @Query() query: QueryFeatureDto,
  ) {
    return this.featureService.findAll(query);
  }

  // GET ONE
  @Get(':id')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.FEATURE_READ,
  )
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.featureService.findOne(id);
  }

  // UPDATE
  @Patch(':id')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.FEATURE_UPDATE,
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureDto,
    @Req() req: any,
  ) {
    return this.featureService.update(
      id,
      dto,
      {
        actorUserId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
      },
    );
  }

  // UPDATE STATUS
  @Patch(':id/status')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.FEATURE_STATUS,
  )
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureStatusDto,
    @Req() req: any,
  ) {
    return this.featureService.updateStatus(
      id,
      dto,
      {
        actorUserId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
      },
    );
  }

  // ACTIVATE
  @Patch(':id/activate')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.FEATURE_ACTIVATE,
  )
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.featureService.activate(
      id,
      {
        actorUserId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
      },
    );
  }

  // DEACTIVATE
  @Patch(':id/deactivate')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.FEATURE_DEACTIVATE,
  )
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.featureService.deactivate(
      id,
      {
        actorUserId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
      },
    );
  }

  // ARCHIVE
  @Patch(':id/archive')
  @RequirePlatformPermissions(
    PLATFORM_PERMISSIONS.FEATURE_ARCHIVE,
  )
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.featureService.archive(
      id,
      {
        actorUserId: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.headers['x-request-id'],
      },
    );
  }
}