import { Module } from '@nestjs/common';

import { InvoiceController } from './invoice.controller';
import { CompanyInvoiceController } from './company-invoice.controller';
import { InvoiceService } from './invoice.service';

@Module({
  controllers: [InvoiceController, CompanyInvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
