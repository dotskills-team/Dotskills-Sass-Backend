import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoleStatus } from 'src/generated/phase-1-prisma/enums';

export class CreatePlatformRoleDto {
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

export class UpdatePlatformRoleDto {
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

export class UpdatePlatformRoleStatusDto {
  @IsEnum(RoleStatus)
  status!: RoleStatus;
}

export enum PlatformPermissionEffectDtoValue {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export class PlatformRolePermissionItemDto {
  @IsString()
  @MaxLength(120)
  code!: string;

  @IsEnum(PlatformPermissionEffectDtoValue)
  effect!: PlatformPermissionEffectDtoValue;
}

export class ReplacePlatformRolePermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlatformRolePermissionItemDto)
  permissions!: PlatformRolePermissionItemDto[];
}
