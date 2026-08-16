import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";
import { BillingCycle } from "src/generated/phase-1-prisma/enums";
// import { BillingCycle } from "../../../generated/phase-1-prisma";

export class ChangeSubscriptionPlanDto {
  @IsUUID() @IsNotEmpty() planId!: string;
  @IsEnum(BillingCycle) billingCycle!: BillingCycle;
}
