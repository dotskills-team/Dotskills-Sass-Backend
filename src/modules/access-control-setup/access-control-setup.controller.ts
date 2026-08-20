import { Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessControlSetupService } from './access-control-setup.service';

@Controller('platform/access-control')
export class AccessControlSetupController {
  constructor(private readonly service: AccessControlSetupService) {}

  @Post('setup')
  @UseGuards(JwtAuthGuard)
  setup(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.setup(actor);
  }
}
