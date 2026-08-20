import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 40)
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'code may contain only uppercase letters, numbers, underscores, and hyphens',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, numbers, and hyphens',
  })
  slug!: string;
}
