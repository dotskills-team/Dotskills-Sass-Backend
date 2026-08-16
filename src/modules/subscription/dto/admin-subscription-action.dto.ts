import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

/**
 * Super Admin-এর manual subscription action-এর body।
 *
 * Suspend, reactivate, cancel এবং expire—
 * প্রত্যেক action-এর জন্য reason বাধ্যতামূলক।
 */
export class AdminSubscriptionActionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}