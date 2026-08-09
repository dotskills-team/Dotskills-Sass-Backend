import { IsJWT, IsOptional, IsString, MaxLength } from "class-validator";

export class RefreshTokenDto {
  @IsJWT()
  refreshToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceId?: string;
}
