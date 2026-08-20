import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdatePlanFeatureDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;
}
