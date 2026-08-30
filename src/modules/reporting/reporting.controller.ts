import { Controller, Get, Header, Query, StreamableFile, UseGuards } from '@nestjs/common';

import { COMPANY_PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { RequireCompanyPermissions } from '../../common/decorators/require-company-permissions.decorator';
import { CompanyContextGuard } from '../../common/guards/company-context.guard';
import { CompanyPermissionsGuard } from '../../common/guards/company-permissions.guard';
import { SubscriptionStatusGuard } from '../../common/guards/subscription-status.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CompanyContext } from '../../common/types/company-context.type';
import { DateRangeReportQueryDto, PaginationQueryDto, StockReportQueryDto } from './dto/report-query.dto';
import { SaleRegisterService } from './sale-register.service';
import { PurchaseRegisterService } from './purchase-register.service';
import { ProfitReportService } from './profit-report.service';
import { StockReportService } from './stock-report.service';
import { LedgerSummaryService } from './ledger-summary.service';

@Controller('companies/:companyId/reports')
@UseGuards(JwtAuthGuard, CompanyContextGuard, SubscriptionStatusGuard, CompanyPermissionsGuard)
export class ReportingController {
  constructor(
    private readonly saleRegisterService: SaleRegisterService,
    private readonly purchaseRegisterService: PurchaseRegisterService,
    private readonly profitReportService: ProfitReportService,
    private readonly stockReportService: StockReportService,
    private readonly ledgerSummaryService: LedgerSummaryService,
  ) {}

  @Get('sale-register')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  getSaleRegister(@CurrentCompany() context: CompanyContext, @Query() query: DateRangeReportQueryDto) {
    return this.saleRegisterService.getSaleRegister(context, query);
  }

  @Get('purchase-register')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  getPurchaseRegister(@CurrentCompany() context: CompanyContext, @Query() query: DateRangeReportQueryDto) {
    return this.purchaseRegisterService.getPurchaseRegister(context, query);
  }

  @Get('profit')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PROFIT_REPORT_READ)
  getProfitReport(@CurrentCompany() context: CompanyContext, @Query() query: DateRangeReportQueryDto) {
    return this.profitReportService.getProfitReport(context, query);
  }

  @Get('stock')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  getStockReport(@CurrentCompany() context: CompanyContext, @Query() query: StockReportQueryDto) {
    return this.stockReportService.getStockReport(context, query);
  }

  @Get('customer-due-summary')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  getCustomerDueSummary(@CurrentCompany() context: CompanyContext, @Query() query: PaginationQueryDto) {
    return this.ledgerSummaryService.getCustomerDueSummary(context, query);
  }

  @Get('supplier-payable-summary')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  getSupplierPayableSummary(@CurrentCompany() context: CompanyContext, @Query() query: PaginationQueryDto) {
    return this.ledgerSummaryService.getSupplierPayableSummary(context, query);
  }

  @Get('sale-register/export')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sale-register.csv"')
  exportSaleRegister(@CurrentCompany() context: CompanyContext, @Query() query: DateRangeReportQueryDto) {
    return new StreamableFile(this.saleRegisterService.streamSaleRegisterCsv(context, query));
  }

  @Get('purchase-register/export')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="purchase-register.csv"')
  exportPurchaseRegister(@CurrentCompany() context: CompanyContext, @Query() query: DateRangeReportQueryDto) {
    return new StreamableFile(this.purchaseRegisterService.streamPurchaseRegisterCsv(context, query));
  }

  @Get('profit/export')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.PROFIT_REPORT_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="profit-report.csv"')
  exportProfitReport(@CurrentCompany() context: CompanyContext, @Query() query: DateRangeReportQueryDto) {
    return new StreamableFile(this.profitReportService.streamProfitReportCsv(context, query));
  }

  @Get('stock/export')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="stock-report.csv"')
  exportStockReport(@CurrentCompany() context: CompanyContext, @Query() query: StockReportQueryDto) {
    return new StreamableFile(this.stockReportService.streamStockReportCsv(context, query));
  }

  @Get('customer-due-summary/export')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="customer-due-summary.csv"')
  exportCustomerDueSummary(@CurrentCompany() context: CompanyContext) {
    return new StreamableFile(this.ledgerSummaryService.streamCustomerDueSummaryCsv(context));
  }

  @Get('supplier-payable-summary/export')
  @RequireCompanyPermissions(COMPANY_PERMISSIONS.REPORT_READ)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="supplier-payable-summary.csv"')
  exportSupplierPayableSummary(@CurrentCompany() context: CompanyContext) {
    return new StreamableFile(this.ledgerSummaryService.streamSupplierPayableSummaryCsv(context));
  }
}
