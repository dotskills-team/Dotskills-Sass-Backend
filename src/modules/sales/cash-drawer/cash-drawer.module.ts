import { Module } from '@nestjs/common';

import { CashDrawerSessionController } from './cash-drawer.controller';
import { CashDrawerSessionService } from './cash-drawer.service';

@Module({
  controllers: [CashDrawerSessionController],
  providers: [CashDrawerSessionService],
  exports: [CashDrawerSessionService],
})
export class CashDrawerSessionModule {}
