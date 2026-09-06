import {
  Body,
  Controller,
  Get,
  ParseFilePipeBuilder,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { COMPANY_PERMISSIONS } from '../../../common/constants/permission.constants';
import { CurrentCompany } from '../../../common/decorators/current-company.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireCompanyPermissions } from '../../../common/decorators/require-company-permissions.decorator';
import { CompanyContextGuard } from '../../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../../common/guards/company-permissions.guard';
import { SubscriptionStatusGuard } from '../../../common/guards/subscription-status.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user.type';
import type { CompanyContext } from '../../../common/types/company-context.type';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/company-settings.dto';

@Controller('companies/:companyId/settings')
@UseGuards(
  JwtAuthGuard,
  CompanyContextGuard,
  SubscriptionStatusGuard,
  CompanyPermissionsGuard,
)
export class CompanySettingsController {
  constructor(private readonly service: CompanySettingsService) {}

  @Get()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SETTINGS_READ)
  get(@CurrentCompany() context: CompanyContext) {
    return this.service.get(context);
  }

  @Patch()
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SETTINGS_UPDATE)
  update(
    @CurrentCompany() context: CompanyContext,
    @Body() dto: UpdateCompanySettingsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.update(context, dto, actor);
  }

  /**
   * Server-side type/size gate via ParseFilePipeBuilder — never trusts the
   * client's own validation (decision #3). 2MB matches the frontend's own
   * limit; PNG/JPEG only.
   */
  @Post('logo')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.SETTINGS_UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @CurrentCompany() context: CompanyContext,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(png|jpeg)$/ })
        .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 })
        .build(),
    )
    file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.uploadLogo(context, file, actor);
  }
}
