import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class CreateCompanyOwnerDto {
  /**
   * `POST /platform/companies/:companyId/owner` never expects this in the
   * body — the controller overwrites it from the URL param, which is
   * authoritative (verified `company-owner.controller.ts`'s `create()`).
   * Optional here only so the pipe's automatic body validation doesn't
   * reject a request that correctly omits it; still `@IsUUID()` if present.
   */
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 160)
  fullName!: string;

  @IsOptional()
  @IsString()
  @Length(5, 32)
  phone?: string;

  @IsString()
  @Length(8, 100)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    {
      message:
        'password must contain uppercase, lowercase, number and special character',
    },
  )
  password!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  designation?: string;
}
