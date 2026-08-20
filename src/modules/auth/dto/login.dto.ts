import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceId?: string;
}
