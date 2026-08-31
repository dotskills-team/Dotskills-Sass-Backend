import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UnitStatus } from 'src/generated/phase-1-prisma/enums';

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsOptional()
  @IsUUID()
  baseUnitId?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'conversionFactor must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'conversionFactor must be greater than 0' })
  conversionFactor?: number;
}

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsUUID()
  baseUnitId?: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'conversionFactor must have maximum 4 decimal places' },
  )
  @Min(0.0001, { message: 'conversionFactor must be greater than 0' })
  conversionFactor?: number;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;
}
