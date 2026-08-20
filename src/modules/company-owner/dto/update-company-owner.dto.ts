import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCompanyOwnerDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(2, 160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Length(5, 32)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  designation?: string;
}
