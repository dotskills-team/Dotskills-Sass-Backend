import { IsOptional, IsString, Length } from 'class-validator';

/**
 * `code` and `slug` are system-generated at creation and never user-editable
 * — including on update, so a name edit can never accidentally reference a
 * changed slug elsewhere. Only `name` may be updated.
 */
export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;
}
