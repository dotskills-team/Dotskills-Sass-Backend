// Add to dto/report-query.dto.ts (imports: IsEnum, IsIn from class-validator)

import { DateRangeReportQueryDto } from "./report-query.dto";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
export const PRODUCT_SALES_SORT_FIELDS = [
  'netSales',
  'quantitySold',
  'grossProfit',
  'saleCount',
  'productName',
] as const;
export type ProductSalesSortField = (typeof PRODUCT_SALES_SORT_FIELDS)[number];

/** Product Sales Report — date range mandatory; productId gives "one product's total sales". */
export class ProductSalesReportQueryDto extends DateRangeReportQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(PRODUCT_SALES_SORT_FIELDS)
  sortBy?: ProductSalesSortField = 'netSales';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}