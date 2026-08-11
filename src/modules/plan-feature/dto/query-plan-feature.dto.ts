import {
  IsBooleanString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class QueryPlanFeatureDto {
  @IsOptional()
  @IsUUID()
  featureId?: string;

  @IsOptional()
  @IsBooleanString()
  enabled?: string;

  @IsOptional()
  @IsString()
  search?: string;
}