import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BootstrapCompanyRbacDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  ownerEmail?: string;
}

export class CreateCompanyRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class UpdateCompanyRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export enum PermissionEffectDtoValue {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export class CompanyRolePermissionItemDto {
  @IsString()
  @MaxLength(120)
  code!: string;

  @IsEnum(PermissionEffectDtoValue)
  effect!: PermissionEffectDtoValue;
}

export class ReplaceCompanyRolePermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompanyRolePermissionItemDto)
  permissions!: CompanyRolePermissionItemDto[];
}

export class CreateCompanyMemberDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes!: string[];
}

export enum CompanyMemberStatusDtoValue {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

export class UpdateCompanyMemberStatusDto {
  @IsEnum(CompanyMemberStatusDtoValue)
  status!: CompanyMemberStatusDtoValue;
}

export class ReplaceCompanyMemberRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleCodes!: string[];
}

export enum CompanyScopeTypeDtoValue {
  COMPANY = 'COMPANY',
  BRANCH = 'BRANCH',
  WAREHOUSE = 'WAREHOUSE',
  POS_COUNTER = 'POS_COUNTER',
}

export class CompanyMemberScopeItemDto {
  @IsEnum(CompanyScopeTypeDtoValue)
  type!: CompanyScopeTypeDtoValue;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  key!: string;
}

export class ReplaceCompanyMemberScopesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompanyMemberScopeItemDto)
  scopes!: CompanyMemberScopeItemDto[];
}
