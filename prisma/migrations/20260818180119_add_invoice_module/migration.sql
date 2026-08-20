-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'VOID');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID,
    "subscriptionId" UUID NOT NULL,
    "billingId" UUID NOT NULL,
    "invoiceNumber" VARCHAR(40) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(20,4) NOT NULL,
    "discountAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(20,4) NOT NULL,
    "priceSnapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ(6),
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "voidedAt" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_sequences" (
    "yearKey" VARCHAR(4) NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("yearKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_billingId_key" ON "invoices"("billingId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_tenantId_status_dueAt_idx" ON "invoices"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "invoices_companyId_status_idx" ON "invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "invoices_subscriptionId_createdAt_idx" ON "invoices"("subscriptionId", "createdAt");

-- CreateIndex
-- NOTE: schema.prisma has declared @@unique([subscriptionId, periodStart, periodEnd]) on Billing
-- since the previous migration, but the 20260817074320_add_billing_models migration only created a
-- plain (non-unique) index for it — pre-existing schema/DB drift, unrelated to Invoice. Adding the
-- missing unique index here since Invoice's duplicate-protection design relies on it. No duplicate
-- rows exist (verified before writing this migration), so this is safe and non-destructive.
CREATE UNIQUE INDEX "billings_subscriptionId_periodStart_periodEnd_key" ON "billings"("subscriptionId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES "billings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
