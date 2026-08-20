-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('SSLCOMMERZ');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID,
    "subscriptionId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currencyCode" CHAR(3) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "providerTransactionId" VARCHAR(64) NOT NULL,
    "gatewayReference" VARCHAR(64),
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "failureReason" TEXT,
    "rawInitiateResponse" JSONB,
    "rawVerifyResponse" JSONB,
    "metadata" JSONB,
    "initiatedAt" TIMESTAMPTZ(6),
    "succeededAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerTransactionId_key" ON "payments"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayReference_key" ON "payments"("gatewayReference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_tenantId_status_idx" ON "payments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "payments_companyId_status_idx" ON "payments"("companyId", "status");

-- CreateIndex
CREATE INDEX "payments_invoiceId_status_idx" ON "payments"("invoiceId", "status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
