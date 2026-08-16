// import {
//   AuditActorType,
//   BillingCycle,
//   SubscriptionStatus,
// } from "../../generated/phase-1-prisma";

import { AuditActorType, BillingCycle, SubscriptionStatus } from "src/generated/phase-1-prisma/enums";

export interface SubscriptionContext {
  userId: string;
  tenantId: string;
  companyId: string;
  actorType?: AuditActorType;
}

// export interface PlatformSubscriptionContext {
//   userId: string;
//   roles: string[];
//   actorType: AuditActorType;
// }


// export interface SystemSubscriptionContext {
//   tenantId: string;
//   companyId: string | null;
//   actorType: AuditActorType.SYSTEM;
//     // actorType: 'SYSTEM';

// }
export interface SystemSubscriptionContext {
  tenantId: string;
  companyId: string | null;
  actorType: typeof AuditActorType.SYSTEM;
}
export interface PriceSnapshot {
  planId: string;
  planCode: string;
  planName: string;
  billingCycle: BillingCycle;
  currencyCode: string;
  amount: string;
  capturedAt: string;
}

export interface TransitionOptions {
  reason: string;
  source: "API" | "PAYMENT" | "SCHEDULER" | "SYSTEM";
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  patch?: Record<string, unknown>;
}

export interface LifecycleRunResult {
  trialsActivated: number;
  activeMarkedPastDue: number;
  pastDueMovedToGrace: number;
  graceSuspended: number;
  suspendedExpired: number;
  cancelledExpired: number;
  failures: Array<{
    subscriptionId: string;
    from: SubscriptionStatus;
    message: string;
  }>;
}

export interface CreateSubscriptionContext {
  userId: string;
  companyId: string;
  roles: string[];
  actorType?: AuditActorType;
}
export interface SubscriptionContext {
  userId: string;
  tenantId: string;
  companyId: string;
  actorType?: AuditActorType;
  roles?: string[];
}

export interface PlatformSubscriptionContext {
  userId: string;
  actorType: AuditActorType;
  roles?: string[];
}

export interface SystemSubscriptionContext {
  tenantId: string;
  companyId: string | null;
  actorType: typeof AuditActorType.SYSTEM;
}