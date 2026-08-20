import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateCompanyDto {
  @IsUUID()
  tenantId!: string;

  @IsUUID()
  industryId!: string;

  @IsString()
  @Length(2, 50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'code must contain only uppercase letters, numbers, underscores or hyphens',
  })
  code!: string;

  @IsString()
  @Length(2, 200)
  legalName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  tradeName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(5, 30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  taxId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  registrationNo?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrencyCode?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  timezone?: string;
}
