import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { CashDrawerSessionStatus } from 'src/generated/phase-1-prisma/enums';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/**
 * Frontend Phase 4 addition. Three optional filters, not just
 * `locationId` — `status` lets the header's "do I have a session open"
 * check stay cheap (never scanning the whole ever-growing history), and
 * `cashierId` lets the Open-Session form correctly preview *this*
 * cashier's own carry-forward balance at a Location, not any cashier's.
 */
export class ListCashDrawerSessionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  cashierId?: string;

  @IsOptional()
  @IsEnum(CashDrawerSessionStatus)
  status?: CashDrawerSessionStatus;
}

export class OpenCashDrawerSessionDto {
  @IsUUID()
  locationId!: string;

  /**
   * Only used when this is the very first session ever for this cashier at
   * this Location — the service derives it from the previous session's
   * actualClosingBalance whenever one exists, ignoring this field.
   */
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'openingBalance must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'openingBalance cannot be negative' })
  openingBalance?: number;
}

export class CloseCashDrawerSessionDto {
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'actualClosingBalance must have maximum 4 decimal places' },
  )
  @Min(0, { message: 'actualClosingBalance cannot be negative' })
  actualClosingBalance!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
