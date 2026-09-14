import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVariantAttributeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  /** Initial set of values (e.g. Size -> ["S","M","L"]) — an attribute with zero values is useless, so at least one is required up front. More can be added later via addValue(). */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  values!: string[];
}

export class AddVariantAttributeValueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  value!: string;
}
