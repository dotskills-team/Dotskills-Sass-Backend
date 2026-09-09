import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  // Same rule as company-rbac.dto.ts/platform-staff.dto.ts — no
  // complexity/character-class rules, just a length floor/ceiling.
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}
