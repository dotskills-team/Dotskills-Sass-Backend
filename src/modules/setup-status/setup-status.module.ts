import { Module } from '@nestjs/common';

import { SetupStatusController } from './setup-status.controller';
import { SetupStatusService } from './setup-status.service';

@Module({
  controllers: [SetupStatusController],
  providers: [SetupStatusService],
})
export class SetupStatusModule {}
