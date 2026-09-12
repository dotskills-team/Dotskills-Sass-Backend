-- Remove dead BillingStatus values (CANCELLED, SKIPPED) and InvoiceStatus
-- value (CANCELLED) — no manual "create/cancel/skip/mark" admin actions
-- exist any more; Billing/Invoice are system-generated only, settled
-- exclusively through the checkout/payment/renewal flow.
--
-- Verified before writing this migration: 0 existing Billing rows have
-- status CANCELLED or SKIPPED, and 0 existing Invoice rows have status
-- CANCELLED (local dev DB). Safe, non-destructive — no data is rewritten
-- or lost by this change.

-- BillingStatus: drop CANCELLED, SKIPPED
CREATE TYPE "BillingStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');
ALTER TABLE "billings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "billings" ALTER COLUMN "status" TYPE "BillingStatus_new" USING ("status"::text::"BillingStatus_new");
ALTER TABLE "billings" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TYPE "BillingStatus" RENAME TO "BillingStatus_old";
ALTER TYPE "BillingStatus_new" RENAME TO "BillingStatus";
DROP TYPE "BillingStatus_old";

-- InvoiceStatus: drop CANCELLED
CREATE TYPE "InvoiceStatus_new" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');
ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING ("status"::text::"InvoiceStatus_new");
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_old";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";
DROP TYPE "InvoiceStatus_old";
