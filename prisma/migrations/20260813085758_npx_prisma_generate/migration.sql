-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "pastDueEndsAt" TIMESTAMPTZ(6),
ADD COLUMN     "suspendedAt" TIMESTAMPTZ(6),
ADD COLUMN     "suspensionExpiresAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID,
    "fromStatus" "SubscriptionStatus",
    "toStatus" "SubscriptionStatus" NOT NULL,
    "reason" VARCHAR(160) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "actorUserId" UUID,
    "idempotencyKey" VARCHAR(200),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_events_idempotencyKey_key" ON "subscription_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "subscription_events_subscriptionId_createdAt_idx" ON "subscription_events"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "subscription_events_tenantId_companyId_createdAt_idx" ON "subscription_events"("tenantId", "companyId", "createdAt");

-- CreateIndex
CREATE INDEX "subscriptions_status_trialEndsAt_idx" ON "subscriptions"("status", "trialEndsAt");

-- CreateIndex
CREATE INDEX "subscriptions_status_pastDueEndsAt_idx" ON "subscriptions"("status", "pastDueEndsAt");

-- CreateIndex
CREATE INDEX "subscriptions_status_graceEndsAt_idx" ON "subscriptions"("status", "graceEndsAt");

-- CreateIndex
CREATE INDEX "subscriptions_status_suspensionExpiresAt_idx" ON "subscriptions"("status", "suspensionExpiresAt");

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
