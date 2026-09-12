import { SubscriptionStatus } from 'src/generated/phase-1-prisma/enums';

/**
 * Subscription lifecycle configuration.
 */
export const SUBSCRIPTION_CONSTANTS = {
  // Subscription history query limit
  MAX_HISTORY_LIMIT: 100,

  // How many days ahead of trialEndsAt/currentPeriodEnd the
  // SUBSCRIPTION_EXPIRING_SOON notification looks.
  EXPIRING_SOON_DAYS: 3,

  // Maximum scheduler processing batch
  LIFECYCLE_BATCH_SIZE: 100,

  // Manual Platform-Admin suspension duration (policy/abuse suspension —
  // unrelated to billing; SubscriptionService.suspendForPlatform() still
  // uses this).
  DEFAULT_SUSPENSION_DAYS: 30,

  // ISSUED invoice sitting under an EXPIRED subscription auto-VOIDs after
  // this many days from issuedAt (fixed, not configurable — a config knob
  // here isn't worth the risk of someone quietly setting it to something
  // that lets a stale, mispriced invoice stay payable).
  STALE_ISSUED_INVOICE_DAYS: 30,
} as const;

/**
 * Allowed subscription status transitions.
 *
 * PAST_DUE and GRACE are no longer reachable by any code path (business
 * decision: a payment failure no longer degrades a subscription in
 * stages — an unpaid period simply expires) but still exist as
 * SubscriptionStatus enum members, kept solely because real historical
 * SubscriptionEvent audit rows reference them — see the enum's own doc
 * comment in schema.prisma. TypeScript's `Record<SubscriptionStatus, ...>`
 * requires every enum key present, so they keep a recovery-only outgoing
 * list here (force back to ACTIVE, or terminate) purely so the type
 * compiles and a pre-existing row would never be silently stuck if one
 * were ever found — nothing produces new rows in these states.
 *
 * SUSPENDED is still reachable — but only via SubscriptionService's manual
 * Platform-Admin suspendForPlatform() (policy/abuse suspension), never
 * automatically from a payment failure. That is a distinct, still-wanted
 * capability, separate from the removed auto-degradation chain.
 */
export const ALLOWED_SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  readonly SubscriptionStatus[]
> = {
  // Trial completion (payment), cancellation, natural trial expiry, or
  // manual Platform-Admin suspension
  [SubscriptionStatus.TRIALING]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.EXPIRED,
  ],

  // Cancellation, period expiry, or manual Platform-Admin suspension
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.EXPIRED,
  ],

  // Resubscribe (payment) at any time, no backdating
  [SubscriptionStatus.EXPIRED]: [SubscriptionStatus.ACTIVE],

  // Reactivation during valid period or final expiry
  [SubscriptionStatus.CANCELLED]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.EXPIRED,
  ],

  // Platform-Admin reactivation, cancellation, or expiry
  [SubscriptionStatus.SUSPENDED]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],

  // Unreachable going forward — recovery or force-expiry only, for a
  // pre-existing row (see doc comment above).
  [SubscriptionStatus.PAST_DUE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],
  [SubscriptionStatus.GRACE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
    SubscriptionStatus.EXPIRED,
  ],
};
