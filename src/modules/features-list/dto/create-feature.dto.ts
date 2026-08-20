import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  module!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
