import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsUUID()
  industryId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  legalName?: string;

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