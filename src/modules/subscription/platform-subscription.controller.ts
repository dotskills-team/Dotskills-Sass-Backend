





import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { PLATFORM_PERMISSIONS } from "../../common/constants/permission.constants";
import { RequirePlatformPermissions } from "../../common/decorators/require-platform-permissions.decorator";
import { PlatformPermissionsGuard } from "../../common/guards/platform-permissions.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminSubscriptionActionDto } from "./dto/admin-subscription-action.dto";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { SubscriptionService } from "./subscription.service";
// import {
//   PlatformSubscriptionContext,
// } from "./subscription.types";
import {
  CreateSubscriptionContext,
  PlatformSubscriptionContext,
  PriceSnapshot,
  SubscriptionContext,
} from "./subscription.types";

import {
  AuditActorType,
} from "src/generated/phase-1-prisma/enums";

interface AuthenticatedRequest extends Request {
  user: {
    id?: string;
    userId?: string;
    roles?: string[];
  };
}

/**
 * Platform-level subscription management endpoints.
 *
 * প্রতিটি endpoint-এ আলাদা granular permission ব্যবহার করা হয়েছে।
 * তাই class-level SUBSCRIPTION_MANAGE permission প্রয়োজন নেই।
 */
@Controller("platform/subscriptions")
@UseGuards(JwtAuthGuard, PlatformPermissionsGuard)
export class PlatformSubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  /** Platform Admin একটি Company-এর জন্য subscription তৈরি করবে। */
  @Post()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.SUBSCRIPTION_CREATE)
  create(
    @Body() dto: CreateSubscriptionDto,
    @Headers("x-company-id") companyId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!companyId?.trim()) {
      throw new BadRequestException("x-company-id header is required.");
    }

    const normalizedCompanyId = companyId.trim();

    if (dto.companyId !== normalizedCompanyId) {
      throw new BadRequestException(
        "Body companyId and x-company-id must match.",
      );
    }

    return this.service.create(dto, {
      userId: this.getUserId(req),
      companyId: normalizedCompanyId,
      roles: req.user.roles ?? [],
    });
  }

  /** Platform থেকে সব Company-এর subscription list দেখা। */
  @Get()
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.SUBSCRIPTION_READ)
  findAll() {
    return this.service.findAllForPlatform();
  }

  /** Platform থেকে একটি subscription-এর details দেখা। */
  @Get(":id")
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.SUBSCRIPTION_READ)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findOneForPlatform(id);
  }

@Post(":id/suspend")
async suspend(
  @Param("id", ParseUUIDPipe) id: string,
  @Body() dto: AdminSubscriptionActionDto,
  @Req() req: AuthenticatedRequest,
) {
  return this.service.suspendForPlatform(
    id,
    dto.reason,
    this.actor(req),
  );
}

@Post(":id/reactivate")
async reactivate(
  @Param("id", ParseUUIDPipe) id: string,
  @Body() dto: AdminSubscriptionActionDto,
  @Req() req: AuthenticatedRequest,
) {
  return this.service.reactivateForPlatform(
    id,
    dto.reason,
    this.actor(req),
  );
}

@Post(":id/cancel")
async cancel(
  @Param("id", ParseUUIDPipe) id: string,
  @Body() dto: AdminSubscriptionActionDto,
  @Req() req: AuthenticatedRequest,
) {
  return this.service.cancelForPlatform(
    id,
    dto.reason,
    this.actor(req),
  );
}

@Post(":id/expire")
async expire(
  @Param("id", ParseUUIDPipe) id: string,
  @Body() dto: AdminSubscriptionActionDto,
  @Req() req: AuthenticatedRequest,
) {
  return this.service.expireForPlatform(
    id,
    dto.reason,
    this.actor(req),
  );
}

  /** JWT payload থেকে authenticated user ID বের করে। */
  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.userId ?? req.user?.id;

    if (!userId) {
      throw new UnauthorizedException("Authenticated user ID is missing.");
    }

    return userId;
  }

  // /** Service method-এর জন্য Platform actor context তৈরি করে। */
  // private actor(req: AuthenticatedRequest) {
  //   return {
  //     userId: this.getUserId(req),
  //     roles: req.user?.roles ?? [],
  //   };
  // }


  private actor(req: AuthenticatedRequest): PlatformSubscriptionContext {
  return {
    userId: this.getUserId(req),
    roles: req.user?.roles ?? [],
    actorType: AuditActorType.PLATFORM_MEMBER,
  };
}
}











// import {
//   BadRequestException,
//   ConflictException,
//   Injectable,
//   NotFoundException,
// } from "@nestjs/common";

// import {
//   Prisma,
//   Subscription,
// } from "src/generated/phase-1-prisma/client";
// import {
//   AuditActorType,
//   BillingCycle,
//   PlanStatus,
//   SubscriptionStatus,
// } from "src/generated/phase-1-prisma/enums";

// import { PrismaService } from "../../prisma/prisma.service";
// import { AdminSubscriptionActionDto } from "./dto/admin-subscription-action.dto";
// import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
// import { ChangeSubscriptionPlanDto } from "./dto/change-subscription-plan.dto";
// import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
// import { UpdateAutoRenewDto } from "./dto/update-auto-renew.dto";
// import { SUBSCRIPTION_CONSTANTS } from "./subscription.constants";
// import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";
// import {
//   PriceSnapshot,
//   SubscriptionContext,
// } from "./subscription.types";

// type CreateSubscriptionContext = {
//   userId: string;
//   companyId: string;
//   tenantId?: string;
//   roles?: string[];
//   actorType?: AuditActorType;
// };

// type PlatformSubscriptionActor = {
//   userId: string;
//   roles: string[];
// };

// @Injectable()
// export class SubscriptionService {
//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly lifecycle: SubscriptionLifecycleService,
//   ) {}

//   async create(
//     dto: CreateSubscriptionDto,
//     context: CreateSubscriptionContext,
//   ) {
//     const company = await this.prisma.company.findUnique({
//       where: { id: dto.companyId },
//     });

//     if (
//       !company ||
//       context.companyId !== company.id ||
//       (context.tenantId && context.tenantId !== company.tenantId)
//     ) {
//       throw new NotFoundException("Company not found.");
//     }

//     const plan = await this.getPlan(dto.planId);
//     const price = await this.getPrice(
//       plan.id,
//       dto.billingCycle,
//       company.baseCurrencyCode,
//     );

//     const existing = await this.prisma.subscription.findFirst({
//       where: {
//         tenantId: company.tenantId,
//         companyId: company.id,
//         status: {
//           notIn: [
//             SubscriptionStatus.CANCELLED,
//             SubscriptionStatus.EXPIRED,
//           ],
//         },
//       },
//     });

//     if (existing) {
//       throw new ConflictException(
//         "Company already has an open subscription lifecycle.",
//       );
//     }

//     const now = new Date();
//     const trialEndsAt =
//       plan.trialDays > 0
//         ? this.addDays(now, plan.trialDays)
//         : null;
//     const periodStart = trialEndsAt ?? now;

//     const snapshot: PriceSnapshot = {
//       planId: plan.id,
//       planCode: plan.code,
//       planName: plan.name,
//       billingCycle: dto.billingCycle,
//       currencyCode: price.currencyCode,
//       amount: price.amount.toString(),
//       capturedAt: now.toISOString(),
//     };

//     return this.prisma.$transaction(async (tx) => {
//       const subscription = await tx.subscription.create({
//         data: {
//           tenantId: company.tenantId,
//           companyId: company.id,
//           planId: plan.id,
//           status: trialEndsAt
//             ? SubscriptionStatus.TRIALING
//             : SubscriptionStatus.ACTIVE,
//           billingCycle: dto.billingCycle,
//           startsAt: now,
//           trialEndsAt,
//           currentPeriodStart: periodStart,
//           currentPeriodEnd: this.lifecycle.calculatePeriodEnd(
//             periodStart,
//             dto.billingCycle,
//           ),
//           autoRenew: true,
//           priceSnapshot:
//             snapshot as unknown as Prisma.InputJsonValue,
//         },
//       });

//       await tx.subscriptionEvent.create({
//         data: {
//           subscriptionId: subscription.id,
//           tenantId: subscription.tenantId,
//           companyId: subscription.companyId,
//           fromStatus: null,
//           toStatus: subscription.status,
//           reason: "SUBSCRIPTION_CREATED",
//           source: "API",
//           actorUserId: context.userId,
//           metadata: {
//             initiatedBy: this.resolveActorType(context),
//           },
//         },
//       });

//       await tx.auditLog.create({
//         data: {
//           tenantId: subscription.tenantId,
//           companyId: subscription.companyId,
//           actorUserId: context.userId,
//           actorType: this.resolveActorType(context),
//           action: "SUBSCRIPTION_CREATED",
//           entityType: "Subscription",
//           entityId: subscription.id,
//           afterData: {
//             status: subscription.status,
//             planId: plan.id,
//             billingCycle: dto.billingCycle,
//           },
//         },
//       });

//       return subscription;
//     });
//   }

//   getCurrent(context: SubscriptionContext) {
//     return this.prisma.subscription.findFirst({
//       where: {
//         tenantId: context.tenantId,
//         companyId: context.companyId,
//         status: { not: SubscriptionStatus.EXPIRED },
//       },
//       include: {
//         plan: {
//           include: {
//             features: {
//               include: { feature: true },
//             },
//           },
//         },
//       },
//       orderBy: { createdAt: "desc" },
//     });
//   }

//   findAll(context: SubscriptionContext) {
//     return this.prisma.subscription.findMany({
//       where: {
//         tenantId: context.tenantId,
//         companyId: context.companyId,
//       },
//       include: { plan: true },
//       orderBy: { createdAt: "desc" },
//       take: SUBSCRIPTION_CONSTANTS.MAX_HISTORY_LIMIT,
//     });
//   }

//   async findOne(id: string, context: SubscriptionContext) {
//     const subscription = await this.prisma.subscription.findFirst({
//       where: {
//         id,
//         tenantId: context.tenantId,
//         companyId: context.companyId,
//       },
//       include: {
//         plan: {
//           include: {
//             features: {
//               include: { feature: true },
//             },
//           },
//         },
//         events: {
//           orderBy: { createdAt: "desc" },
//           take: 100,
//         },
//       },
//     });

//     if (!subscription) {
//       throw new NotFoundException("Subscription not found.");
//     }

//     return subscription;
//   }

//   findAllForPlatform() {
//     return this.prisma.subscription.findMany({
//       include: {
//         company: true,
//         plan: true,
//       },
//       orderBy: { createdAt: "desc" },
//       take: 200,
//     });
//   }

//   async findOneForPlatform(id: string) {
//     const subscription = await this.prisma.subscription.findUnique({
//       where: { id },
//       include: {
//         company: true,
//         plan: {
//           include: {
//             features: {
//               include: { feature: true },
//             },
//           },
//         },
//         events: {
//           orderBy: { createdAt: "desc" },
//           take: 100,
//         },
//       },
//     });

//     if (!subscription) {
//       throw new NotFoundException("Subscription not found.");
//     }

//     return subscription;
//   }

//   async updateAutoRenew(
//     id: string,
//     dto: UpdateAutoRenewDto,
//     context: SubscriptionContext,
//   ) {
//     const subscription = await this.scoped(id, context);

//     if (
//       subscription.status === SubscriptionStatus.CANCELLED ||
//       subscription.status === SubscriptionStatus.EXPIRED
//     ) {
//       throw new BadRequestException(
//         "Auto-renew cannot be changed in this state.",
//       );
//     }

//     return this.prisma.subscription.update({
//       where: { id },
//       data: { autoRenew: dto.autoRenew },
//     });
//   }

//   async changePlan(
//     id: string,
//     dto: ChangeSubscriptionPlanDto,
//     context: SubscriptionContext,
//   ) {
//     const subscription = await this.scoped(id, context);

//     if (
//       subscription.status === SubscriptionStatus.CANCELLED ||
//       subscription.status === SubscriptionStatus.EXPIRED
//     ) {
//       throw new BadRequestException(
//         "Plan cannot be changed in this state.",
//       );
//     }

//     const plan = await this.getPlan(dto.planId);
//     const company = await this.prisma.company.findFirst({
//       where: {
//         id: context.companyId,
//         tenantId: context.tenantId,
//       },
//     });

//     if (!company) {
//       throw new NotFoundException("Company not found.");
//     }

//     const price = await this.getPrice(
//       plan.id,
//       dto.billingCycle,
//       company.baseCurrencyCode,
//     );

//     const snapshot: PriceSnapshot = {
//       planId: plan.id,
//       planCode: plan.code,
//       planName: plan.name,
//       billingCycle: dto.billingCycle,
//       currencyCode: price.currencyCode,
//       amount: price.amount.toString(),
//       capturedAt: new Date().toISOString(),
//     };

//     return this.prisma.subscription.update({
//       where: { id },
//       data: {
//         planId: plan.id,
//         billingCycle: dto.billingCycle,
//         priceSnapshot:
//           snapshot as unknown as Prisma.InputJsonValue,
//       },
//     });
//   }

//   async cancel(
//     id: string,
//     dto: CancelSubscriptionDto,
//     context: SubscriptionContext,
//   ) {
//     const subscription = await this.scoped(id, context);

//     return this.lifecycle.transition(
//       subscription,
//       SubscriptionStatus.CANCELLED,
//       context,
//       {
//         reason: dto.reason?.trim() || "USER_CANCELLED",
//         source: "API",
//         patch: {
//           cancelledAt: new Date(),
//           autoRenew: false,
//         },
//       },
//     );
//   }

//   async reactivate(id: string, context: SubscriptionContext) {
//     const subscription = await this.scoped(id, context);

//     if (subscription.status !== SubscriptionStatus.CANCELLED) {
//       throw new BadRequestException(
//         "Only CANCELLED subscriptions can be reactivated.",
//       );
//     }

//     if (subscription.currentPeriodEnd <= new Date()) {
//       throw new BadRequestException(
//         "Cancellation period has ended; create or renew a subscription instead.",
//       );
//     }

//     return this.lifecycle.transition(
//       subscription,
//       SubscriptionStatus.ACTIVE,
//       context,
//       {
//         reason: "USER_REACTIVATED",
//         source: "API",
//         patch: {
//           cancelledAt: null,
//           autoRenew: true,
//         },
//       },
//     );
//   }

//   async suspendForPlatform(
//     id: string,
//     dto: AdminSubscriptionActionDto,
//     actor: PlatformSubscriptionActor,
//   ) {
//     const subscription = await this.findForPlatformAction(id);

//     if (subscription.status === SubscriptionStatus.SUSPENDED) {
//       throw new BadRequestException(
//         "Subscription is already suspended.",
//       );
//     }

//     if (
//       subscription.status === SubscriptionStatus.CANCELLED ||
//       subscription.status === SubscriptionStatus.EXPIRED
//     ) {
//       throw new BadRequestException(
//         `${subscription.status} subscription cannot be suspended.`,
//       );
//     }

//     return this.lifecycle.transition(
//       subscription,
//       SubscriptionStatus.SUSPENDED,
//       this.platformContext(subscription, actor),
//       {
//         reason: dto.reason.trim(),
//         source: "API",
//         patch: {
//           suspendedAt: new Date(),
//           suspensionExpiresAt: null,
//           pastDueEndsAt: null,
//           graceEndsAt: null,
//         },
//         metadata: {
//           initiatedBy: "PLATFORM_ADMIN",
//           operation: "MANUAL_SUSPEND",
//         },
//       },
//     );
//   }

//   async reactivateForPlatform(
//     id: string,
//     dto: AdminSubscriptionActionDto,
//     actor: PlatformSubscriptionActor,
//   ) {
//     const subscription = await this.findForPlatformAction(id);

//     if (subscription.status !== SubscriptionStatus.SUSPENDED) {
//       throw new BadRequestException(
//         "Only SUSPENDED subscriptions can be reactivated by Platform Admin.",
//       );
//     }

//     return this.lifecycle.transition(
//       subscription,
//       SubscriptionStatus.ACTIVE,
//       this.platformContext(subscription, actor),
//       {
//         reason: dto.reason.trim(),
//         source: "API",
//         patch: {
//           suspendedAt: null,
//           suspensionExpiresAt: null,
//           pastDueEndsAt: null,
//           graceEndsAt: null,
//           cancelledAt: null,
//         },
//         metadata: {
//           initiatedBy: "PLATFORM_ADMIN",
//           operation: "MANUAL_REACTIVATE",
//         },
//       },
//     );
//   }

//   async cancelForPlatform(
//     id: string,
//     dto: AdminSubscriptionActionDto,
//     actor: PlatformSubscriptionActor,
//   ) {
//     const subscription = await this.findForPlatformAction(id);

//     if (subscription.status === SubscriptionStatus.CANCELLED) {
//       throw new BadRequestException(
//         "Subscription is already cancelled.",
//       );
//     }

//     if (subscription.status === SubscriptionStatus.EXPIRED) {
//       throw new BadRequestException(
//         "An EXPIRED subscription cannot be cancelled.",
//       );
//     }

//     return this.lifecycle.transition(
//       subscription,
//       SubscriptionStatus.CANCELLED,
//       this.platformContext(subscription, actor),
//       {
//         reason: dto.reason.trim(),
//         source: "API",
//         patch: {
//           cancelledAt: new Date(),
//           autoRenew: false,
//           pastDueEndsAt: null,
//           graceEndsAt: null,
//           suspendedAt: null,
//           suspensionExpiresAt: null,
//         },
//         metadata: {
//           initiatedBy: "PLATFORM_ADMIN",
//           operation: "MANUAL_CANCEL",
//         },
//       },
//     );
//   }

//   async expireForPlatform(
//     id: string,
//     dto: AdminSubscriptionActionDto,
//     actor: PlatformSubscriptionActor,
//   ) {
//     const subscription = await this.findForPlatformAction(id);

//     if (subscription.status === SubscriptionStatus.EXPIRED) {
//       throw new BadRequestException(
//         "Subscription is already expired.",
//       );
//     }

//     return this.lifecycle.transition(
//       subscription,
//       SubscriptionStatus.EXPIRED,
//       this.platformContext(subscription, actor),
//       {
//         reason: dto.reason.trim(),
//         source: "API",
//         patch: {
//           autoRenew: false,
//           trialEndsAt: null,
//           pastDueEndsAt: null,
//           graceEndsAt: null,
//           suspendedAt: null,
//           suspensionExpiresAt: null,
//         },
//         metadata: {
//           initiatedBy: "PLATFORM_ADMIN",
//           operation: "MANUAL_EXPIRE",
//         },
//       },
//     );
//   }

//   private async scoped(
//     id: string,
//     context: SubscriptionContext,
//   ) {
//     const subscription = await this.prisma.subscription.findFirst({
//       where: {
//         id,
//         tenantId: context.tenantId,
//         companyId: context.companyId,
//       },
//     });

//     if (!subscription) {
//       throw new NotFoundException("Subscription not found.");
//     }

//     return subscription;
//   }

//   private async findForPlatformAction(
//     id: string,
//   ): Promise<Subscription> {
//     const subscription = await this.prisma.subscription.findUnique({
//       where: { id },
//     });

//     if (!subscription) {
//       throw new NotFoundException("Subscription not found.");
//     }

//     if (!subscription.companyId) {
//       throw new BadRequestException(
//         "Subscription is not associated with a company.",
//       );
//     }

//     return subscription;
//   }

//   private platformContext(
//     subscription: Subscription,
//     actor: PlatformSubscriptionActor,
//   ): SubscriptionContext {
//     if (!subscription.companyId) {
//       throw new BadRequestException(
//         "Subscription company context is missing.",
//       );
//     }

//     return {
//       userId: actor.userId,
//       tenantId: subscription.tenantId,
//       companyId: subscription.companyId,
//       roles: actor.roles,
//       actorType: AuditActorType.PLATFORM_MEMBER,
//     };
//   }

//   private async getPlan(id: string) {
//     const plan = await this.prisma.plan.findFirst({
//       where: {
//         id,
//         status: PlanStatus.ACTIVE,
//       },
//     });

//     if (!plan) {
//       throw new NotFoundException("Active plan not found.");
//     }

//     return plan;
//   }

//   private async getPrice(
//     planId: string,
//     billingCycle: BillingCycle,
//     currencyCode: string,
//   ) {
//     const now = new Date();

//     const price = await this.prisma.planPrice.findFirst({
//       where: {
//         planId,
//         billingCycle,
//         currencyCode,
//         isActive: true,
//         effectiveFrom: { lte: now },
//         OR: [
//           { effectiveTo: null },
//           { effectiveTo: { gt: now } },
//         ],
//       },
//       orderBy: { effectiveFrom: "desc" },
//     });

//     if (!price) {
//       throw new NotFoundException(
//         "Active plan price not found for the company currency.",
//       );
//     }

//     return price;
//   }

//   private resolveActorType(
//     context: CreateSubscriptionContext,
//   ): AuditActorType {
//     if (context.actorType) {
//       return context.actorType;
//     }

//     const platformRoles = ["SUPER_ADMIN", "PLATFORM_ADMIN"];
//     const isPlatformActor =
//       context.roles?.some((role) =>
//         platformRoles.includes(role),
//       ) ?? false;

//     return isPlatformActor
//       ? AuditActorType.PLATFORM_MEMBER
//       : AuditActorType.COMPANY_MEMBER;
//   }

//   private addDays(date: Date, days: number) {
//     const result = new Date(date);
//     result.setUTCDate(result.getUTCDate() + days);
//     return result;
//   }
// }

// import {
//   BadRequestException,
//   Body,
//   Controller,
//   Get,
//   Headers,
//   Param,
//   ParseUUIDPipe,
//   Post,
//   Req,
//   UnauthorizedException,
//   UseGuards,
// } from "@nestjs/common";
// import { Request } from "express";

// import { PLATFORM_PERMISSIONS } from "src/common/constants/permission.constants";
// import { RequirePlatformPermissions } from "src/common/decorators/require-platform-permissions.decorator";
// import { PlatformPermissionsGuard } from "src/common/guards/platform-permissions.guard";

// import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
// import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
// import { SubscriptionService } from "./subscription.service";

// interface AuthenticatedRequest extends Request {
//   user: {
//     id?: string;
//     userId?: string;
//     roles?: string[];
//   };
// }

// @Controller("platform/subscriptions")
// @UseGuards(
//   JwtAuthGuard,
//   PlatformPermissionsGuard,
// )
// export class PlatformSubscriptionController {
//   constructor(
//     private readonly service: SubscriptionService,
//   ) {}

//   /**
//    * Platform Admin একটি Company-এর জন্য
//    * নতুন subscription তৈরি করবে।
//    */
//   @Post()
//   @RequirePlatformPermissions(
//     PLATFORM_PERMISSIONS.SUBSCRIPTION_CREATE,
//   )
//   create(
//     @Body()
//     dto: CreateSubscriptionDto,

//     @Headers("x-company-id")
//     companyId: string | undefined,

//     @Req()
//     req: AuthenticatedRequest,
//   ) {
//     if (!companyId?.trim()) {
//       throw new BadRequestException(
//         "x-company-id header is required.",
//       );
//     }

//     const normalizedCompanyId =
//       companyId.trim();

//     if (dto.companyId !== normalizedCompanyId) {
//       throw new BadRequestException(
//         "Body companyId and x-company-id must match.",
//       );
//     }

//     const userId =
//       req.user.userId ?? req.user.id;

//     if (!userId) {
//       throw new UnauthorizedException(
//         "Authenticated user ID is missing.",
//       );
//     }

//     return this.service.create(dto, {
//       userId,
//       companyId: normalizedCompanyId,
//       roles: req.user.roles ?? [],
//     });
//   }

//   /**
//    * Platform থেকে সব Company-এর
//    * subscription list দেখা।
//    */
//   @Get()
//   @RequirePlatformPermissions(
//     PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
//   )
//   findAll() {
//     return this.service.findAllForPlatform();
//   }

//   /**
//    * Platform থেকে নির্দিষ্ট একটি
//    * subscription-এর details দেখা।
//    */
//   @Get(":id")
//   @RequirePlatformPermissions(
//     PLATFORM_PERMISSIONS.SUBSCRIPTION_READ,
//   )
//   findOne(
//     @Param("id", ParseUUIDPipe)
//     id: string,
//   ) {
//     return this.service.findOneForPlatform(id);
//   }
// }