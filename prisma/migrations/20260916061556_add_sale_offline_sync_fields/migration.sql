-- AlterEnum
ALTER TYPE "NotificationRelatedEntityType" ADD VALUE 'SALE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SALE_NEEDS_REVIEW';

-- AlterEnum
ALTER TYPE "SaleStatus" ADD VALUE 'NEEDS_REVIEW';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "idempotencyKey" VARCHAR(200);

-- Partial unique index: only offline-replayed sales carry a non-null
-- idempotencyKey, so this must exclude NULL rows (Postgres unique indexes
-- already treat every NULL as distinct from every other NULL, but being
-- explicit here matches the inventory_no_variant_unique/
-- inventory_variant_unique precedent and documents the intent).
CREATE UNIQUE INDEX "sale_idempotency_key_unique" ON "sales"("tenantId", "companyId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
