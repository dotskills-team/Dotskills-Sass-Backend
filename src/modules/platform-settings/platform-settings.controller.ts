import {
  Controller,
  Get,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { PLATFORM_PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePlatformPermissions } from '../../common/decorators/require-platform-permissions.decorator';
import { PlatformPermissionsGuard } from '../../common/guards/platform-permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('platform/settings')
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformSettingsController {
  constructor(private readonly service: PlatformSettingsService) {}

  /**
   * No permission decorator — every authenticated platform user needs to
   * see the branding (sidebar/navbar logo), not just staff with a
   * particular permission. `SETTINGS_READ` is still granted to Super Admin
   * by default and reserved for a future admin-only settings list view;
   * only the actual write action (uploadLogo) is permission-gated here.
   */
  @Get()
  get() {
    return this.service.get();
  }

  /**
   * Server-side type/size gate via ParseFilePipeBuilder — never trusts the
   * client's own validation, exactly like Company Settings' own logo route.
   */
  @Post('logo')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.SETTINGS_UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(png|jpeg)$/ })
        .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 })
        .build(),
    )
    file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.uploadLogo(file, actor);
  }
}
