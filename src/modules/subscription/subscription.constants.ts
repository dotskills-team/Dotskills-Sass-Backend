// // import { SubscriptionStatus } from "../../generated/phase-1-prisma";

// import { SubscriptionStatus } from "src/generated/phase-1-prisma/enums";

// export const SUBSCRIPTION_CONSTANTS = {
//   DEFAULT_GRACE_DAYS: 7,
//   DEFAULT_PAST_DUE_DAYS: 1,
//   DEFAULT_SUSPENSION_DAYS: 30,
//   MAX_HISTORY_LIMIT: 100,
//   LIFECYCLE_BATCH_SIZE: 100,
// } as const;

// export const ALLOWED_SUBSCRIPTION_TRANSITIONS: Readonly<
//   Record<SubscriptionStatus, readonly SubscriptionStatus[]>
// > = {
//   TRIALING: [
//     SubscriptionStatus.ACTIVE,
//     SubscriptionStatus.CANCELLED,
//     SubscriptionStatus.EXPIRED,
//   ],
//   ACTIVE: [
//     SubscriptionStatus.PAST_DUE,
//     SubscriptionStatus.CANCELLED,
//     SubscriptionStatus.EXPIRED,
//   ],
//   PAST_DUE: [
//     SubscriptionStatus.ACTIVE,
//     SubscriptionStatus.GRACE,
//     SubscriptionStatus.CANCELLED,
//   ],
//   GRACE: [
//     SubscriptionStatus.ACTIVE,
//     SubscriptionStatus.SUSPENDED,
//     SubscriptionStatus.CANCELLED,
//   ],
//   SUSPENDED: [
//     SubscriptionStatus.ACTIVE,
//     SubscriptionStatus.EXPIRED,
//     SubscriptionStatus.CANCELLED,
//   ],
//   CANCELLED: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED],
//   EXPIRED: [],
// };
import {
  SubscriptionStatus,
} from "src/generated/phase-1-prisma/enums";

/**
 * Subscription lifecycle configuration.
 */
export const SUBSCRIPTION_CONSTANTS = {
  // Subscription history query limit
  MAX_HISTORY_LIMIT: 100,

  // ACTIVE → PAST_DUE deadline
  DEFAULT_PAST_DUE_DAYS: 3,

  // PAST_DUE → GRACE duration
  DEFAULT_GRACE_DAYS: 7,

  // SUSPENDED → EXPIRED duration
  DEFAULT_SUSPENSION_DAYS: 30,

  // Maximum scheduler processing batch
  LIFECYCLE_BATCH_SIZE: 100,
} as const;

/**
 * Allowed subscription status transitions.
 */
export const ALLOWED_SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  readonly SubscriptionStatus[]
> = {
  // Trial completion or Platform Admin override
  [SubscriptionStatus.TRIALING]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.EXPIRED,
  ],

  // Payment failure, cancellation or Admin override
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.EXPIRED,
  ],

  // Payment recovery, grace period or Admin override
  [SubscriptionStatus.PAST_DUE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.GRACE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.EXPIRED,
  ],

  // Payment recovery, suspension or cancellation
  [SubscriptionStatus.GRACE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],

  // Payment/Admin reactivation, cancellation or expiry
  [SubscriptionStatus.SUSPENDED]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],

  // Reactivation during valid period or final expiry
  [SubscriptionStatus.CANCELLED]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.EXPIRED,
  ],

  // EXPIRED is a terminal status
  [SubscriptionStatus.EXPIRED]: [],
};