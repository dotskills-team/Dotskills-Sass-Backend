import { Module } from '@nestjs/common';

import { UnitController } from './unit.controller';
import { UnitService } from './unit.service';
import { UnitConversionService } from './unit-conversion.service';

@Module({
  controllers: [UnitController],
  providers: [UnitService, UnitConversionService],
  exports: [UnitService, UnitConversionService],
})
export class UnitModule {}
