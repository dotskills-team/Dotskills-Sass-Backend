import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { DevelopmentOnlyGuard } from './guards/development-only.guard';
import { PlatformRbacController } from './platform-rbac.controller';
import { PlatformRbacService } from './platform-rbac.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformRbacController],
  providers: [PlatformRbacService, DevelopmentOnlyGuard],
})
export class PlatformRbacModule {}
