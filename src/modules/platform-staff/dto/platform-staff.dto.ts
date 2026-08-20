import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlatformStaffDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes!: string[];
}

export class UpdatePlatformStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;
}

export class ReplacePlatformRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes!: string[];
}

export enum PlatformStaffStatusDtoValue {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

export class UpdatePlatformStaffStatusDto {
  @IsEnum(PlatformStaffStatusDtoValue)
  status!: PlatformStaffStatusDtoValue;
}

export class PlatformStaffListQueryDto {
  @IsOptional()
  @IsEnum(PlatformStaffStatusDtoValue)
  status?: PlatformStaffStatusDtoValue;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  page?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  limit?: string;
}
