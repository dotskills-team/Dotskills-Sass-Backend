import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UpdateNameDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  fullName!: string;
}
