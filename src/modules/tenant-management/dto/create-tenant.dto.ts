import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * `code` and `slug` are never accepted from the client — both are
 * system-generated from `name` (see `TenantManagementService.create()`),
 * unique, stable, and not user-editable.
 */
export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  name!: string;
}
