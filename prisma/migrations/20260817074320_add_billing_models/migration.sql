-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BillingAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "billings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID,
    "subscriptionId" UUID NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'PENDING',
    "billingCycle" "BillingCycle" NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "processedAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6),
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "priceSnapshot" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_attempts" (
    "id" UUID NOT NULL,
    "billingId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "BillingAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "attemptedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "failureCode" VARCHAR(100),
    "failureMessage" TEXT,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billings_idempotencyKey_key" ON "billings"("idempotencyKey");

-- CreateIndex
CREATE INDEX "billings_tenantId_status_dueAt_idx" ON "billings"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "billings_companyId_status_dueAt_idx" ON "billings"("companyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "billings_subscriptionId_periodStart_periodEnd_idx" ON "billings"("subscriptionId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "billings_status_nextAttemptAt_idx" ON "billings"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_attempts_idempotencyKey_key" ON "billing_attempts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "billing_attempts_billingId_createdAt_idx" ON "billing_attempts"("billingId", "createdAt");

-- CreateIndex
CREATE INDEX "billing_attempts_status_attemptedAt_idx" ON "billing_attempts"("status", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_attempts_billingId_attemptNumber_key" ON "billing_attempts"("billingId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "billings" ADD CONSTRAINT "billings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billings" ADD CONSTRAINT "billings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billings" ADD CONSTRAINT "billings_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_attempts" ADD CONSTRAINT "billing_attempts_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES "billings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
