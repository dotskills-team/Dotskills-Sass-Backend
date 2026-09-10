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
 * PAST_DUE/GRACE are no longer reachable (business decision: a payment
 * failure no longer degrades a subscription in stages — an unpaid period
 * simply expires) but keep their Record key (TypeScript exhaustiveness)
 * and a recovery-only outgoing list, so a pre-existing row already sitting
 * in one of these states (e.g. older local data) can still be manually
 * recovered or force-expired rather than being permanently stuck.
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

  // Legacy/unreachable-going-forward — recovery or force-expiry only
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
