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

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UserProfileService } from './user-profile.service';
import { ChangePasswordDto } from './dto/change-password.dto';

/**
 * Deliberately guarded by JwtAuthGuard only — no company/platform scope
 * guard. Every route here is scoped exclusively by the caller's own
 * actor.userId/actor.sessionId (from the JWT), never by anything
 * client-supplied, since a profile is user-scoped, not company- or
 * platform-scoped.
 */
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UserProfileController {
  constructor(private readonly service: UserProfileService) {}

  @Get('profile')
  getProfile(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.getProfile(actor);
  }

  @Post('profile-image')
  @UseInterceptors(FileInterceptor('file'))
  uploadProfileImage(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(png|jpeg)$/ })
        .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.service.uploadProfileImage(actor, file);
  }

  @Patch('password')
  changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.service.changePassword(actor, dto);
  }
}
