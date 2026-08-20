import { Module } from '@nestjs/common';

import { CompanyOwnerController } from './company-owner.controller';
import { CompanyOwnerService } from './company-owner.service';

import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyOwnerController],
  providers: [CompanyOwnerService],
  exports: [CompanyOwnerService],
})
export class CompanyOwnerModule {}
