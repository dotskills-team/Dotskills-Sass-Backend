import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export enum FeatureConfigFieldType {
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  STRING = 'STRING',
  SELECT = 'SELECT',
  MULTI_SELECT = 'MULTI_SELECT',
}

export class FeatureConfigFieldOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  value!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;
}

/**
 * Feature-এর নিজস্ব configuration definition — কোন field-গুলো PlanFeature.limits-এ
 * configure করা যাবে সেটার schema। Feature master catalog-এর অংশ, তাই এখানেই define
 * হয় (verified: আগে কোনো config-definition ছিল না, `limits` সম্পূর্ণ schema-less ছিল)।
 */
export class FeatureConfigFieldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message:
      'key must start with a letter and contain only letters, numbers, and underscores',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(FeatureConfigFieldType)
  type!: FeatureConfigFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  defaultValue?: unknown;

  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeatureConfigFieldOptionDto)
  options?: FeatureConfigFieldOptionDto[];
}
