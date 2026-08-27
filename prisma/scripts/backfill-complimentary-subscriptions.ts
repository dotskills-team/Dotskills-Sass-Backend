/**
 * One-off deploy-time backfill — run once when Part 1's SubscriptionStatusGuard
 * ships, so no pre-existing Company is ever locked out by the new enforcement.
 *
 * For every existing Company:
 *   - has a Subscription -> set isComplimentary = true (grandfathered, Admin
 *     reviews and un-flags later; never touches status/dates/priceSnapshot)
 *   - has no Subscription at all -> create one minimal isComplimentary
 *     Subscription (prefers the isDefaultTrial Plan if configured, else any
 *     ACTIVE Plan with a MONTHLY price, else falls back to a placeholder
 *     price snapshot so the row can still exist and be reviewed manually)
 *
 * Never deletes, never overwrites an existing Subscription's business fields
 * beyond the one new boolean flag.
 *
 * Usage:
 *   npx ts-node --transpile-only prisma/scripts/backfill-complimentary-subscriptions.ts            (dry run, default)
 *   npx ts-node --transpile-only prisma/scripts/backfill-complimentary-subscriptions.ts --apply     (actually writes)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../../src/generated/phase-1-prisma/client';
import {
  BillingCycle,
  SubscriptionStatus,
} from '../../src/generated/phase-1-prisma/enums';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing in .env');
}
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes — pass --apply to execute)'}`);

  const companies = await prisma.company.findMany({
    select: { id: true, tenantId: true, baseCurrencyCode: true, legalName: true },
  });

  console.log(`Found ${companies.length} companies.`);

  let flaggedExisting = 0;
  let createdNew = 0;
  let skippedAlreadyComplimentary = 0;

  const defaultTrialPlan = await prisma.plan.findFirst({
    where: { isDefaultTrial: true, status: 'ACTIVE' },
  });

  for (const company of companies) {
    const latestSubscription = await prisma.subscription.findFirst({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
    });

    if (latestSubscription) {
      if (latestSubscription.isComplimentary) {
        skippedAlreadyComplimentary++;
        continue;
      }

      console.log(
        `[flag] Company "${company.legalName}" (${company.id}) — Subscription ${latestSubscription.id} (${latestSubscription.status}) -> isComplimentary=true`,
      );
      flaggedExisting++;

      if (APPLY) {
        await prisma.subscription.update({
          where: { id: latestSubscription.id },
          data: { isComplimentary: true },
        });
      }
      continue;
    }

    // No subscription at all — create a minimal complimentary one.
    let plan = defaultTrialPlan;
    let price = plan
      ? await prisma.planPrice.findFirst({
          where: {
            planId: plan.id,
            billingCycle: BillingCycle.MONTHLY,
            currencyCode: company.baseCurrencyCode,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
        })
      : null;

    if (!plan || !price) {
      // Fall back to any ACTIVE plan with any active price, in any currency —
      // this row exists only so the guard has something to find; Admin
      // reviews it manually afterward (it's isComplimentary, so it doesn't
      // block anything in the meantime).
      plan = await prisma.plan.findFirst({ where: { status: 'ACTIVE' } });
      price = plan
        ? await prisma.planPrice.findFirst({
            where: { planId: plan.id, isActive: true },
            orderBy: { effectiveFrom: 'desc' },
          })
        : null;
    }

    if (!plan || !price) {
      console.warn(
        `[skip] Company "${company.legalName}" (${company.id}) — no Plan/Price exists at all in the system yet, cannot create a placeholder Subscription. Handle manually.`,
      );
      continue;
    }

    console.log(
      `[create] Company "${company.legalName}" (${company.id}) — no Subscription found, creating complimentary ${plan.code} (${price.billingCycle})`,
    );
    createdNew++;

    if (APPLY) {
      const now = new Date();
      await prisma.subscription.create({
        data: {
          tenantId: company.tenantId,
          companyId: company.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: price.billingCycle,
          startsAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(
            now.getTime() +
              (price.billingCycle === BillingCycle.YEARLY ? 365 : 30) *
                24 *
                60 *
                60 *
                1000,
          ),
          autoRenew: false,
          isComplimentary: true,
          priceSnapshot: {
            planId: plan.id,
            planCode: plan.code,
            planName: plan.name,
            billingCycle: price.billingCycle,
            currencyCode: price.currencyCode,
            amount: price.amount.toString(),
            capturedAt: now.toISOString(),
            note: 'backfilled by backfill-complimentary-subscriptions.ts',
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  console.log('---');
  console.log(`Existing subscriptions flagged isComplimentary: ${flaggedExisting}`);
  console.log(`Already isComplimentary (skipped): ${skippedAlreadyComplimentary}`);
  console.log(`New placeholder subscriptions created: ${createdNew}`);
  if (!APPLY) {
    console.log('This was a DRY RUN — re-run with --apply to write these changes.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
