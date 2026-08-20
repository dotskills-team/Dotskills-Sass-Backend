import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateIndustryDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'Code must contain only uppercase letters, numbers, underscore, and hyphen',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;
}
