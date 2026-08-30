import { Module } from '@nestjs/common';

import { ReportingController } from './reporting.controller';
import { SaleRegisterService } from './sale-register.service';
import { PurchaseRegisterService } from './purchase-register.service';
import { ProfitReportService } from './profit-report.service';
import { StockReportService } from './stock-report.service';
import { LedgerSummaryService } from './ledger-summary.service';

@Module({
  controllers: [ReportingController],
  providers: [SaleRegisterService, PurchaseRegisterService, ProfitReportService, StockReportService, LedgerSummaryService],
})
export class ReportingModule {}
