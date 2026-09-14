import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator';

export class ResetPasswordDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @Length(1, 512)
  token!: string;

  // Same length floor as ChangePasswordDto/company-rbac/platform-staff DTOs
  // — no complexity/character-class rules, just a length floor/ceiling.
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Match('password')
  passwordConfirmation!: string;
}
