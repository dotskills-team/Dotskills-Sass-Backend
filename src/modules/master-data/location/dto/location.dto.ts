import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LocationStatus, LocationType } from 'src/generated/phase-1-prisma/enums';

export class CreateLocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEnum(LocationType)
  locationType!: LocationType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @IsOptional()
  @IsBoolean()
  isSalesEnabled?: boolean;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  address?: string;

  @IsOptional()
  @IsBoolean()
  isSalesEnabled?: boolean;

  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;
}
