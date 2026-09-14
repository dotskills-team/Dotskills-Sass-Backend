import { Module } from '@nestjs/common';

import { VariantAttributeController } from './variant-attribute.controller';
import { VariantAttributeService } from './variant-attribute.service';

@Module({
  controllers: [VariantAttributeController],
  providers: [VariantAttributeService],
  exports: [VariantAttributeService],
})
export class VariantAttributeModule {}
