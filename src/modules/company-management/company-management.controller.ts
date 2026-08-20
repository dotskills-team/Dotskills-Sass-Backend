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

import { CompanyManagementService } from './company-management.service';

import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';

import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePlatformPermissions } from 'src/common/decorators/require-platform-permissions.decorator';
import { PLATFORM_PERMISSIONS } from 'src/common/constants/permission.constants';

@Controller('platform/companies')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class CompanyManagementController {
  constructor(private readonly companyService: CompanyManagementService) {}

  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_CREATE)
  create(@Body() dto: CreateCompanyDto, @Req() req: any) {
    return this.companyService.create(dto, req.user.userId);
  }

  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_READ)
  findAll(@Query() query: CompanyQueryDto) {
    return this.companyService.findAll(query);
  }

  @Get(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_STATUS)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyStatusDto,
  ) {
    return this.companyService.updateStatus(id, dto);
  }

  @Post(':id/activate')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_ACTIVATE)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.activate(id);
  }

  @Post(':id/suspend')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.COMPANY_SUSPEND)
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.suspend(id);
  }
}
