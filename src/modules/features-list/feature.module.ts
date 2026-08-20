import { Module } from '@nestjs/common';

import { FeatureController } from './feature.controller';
import { FeatureService } from './feature.service';

import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [FeatureController],

  providers: [FeatureService, PrismaService],

  exports: [FeatureService],
})
export class FeatureModule {}
