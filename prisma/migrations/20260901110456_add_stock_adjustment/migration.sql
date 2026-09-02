-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('DAMAGE', 'THEFT_SHRINKAGE', 'COUNT_MISMATCH', 'EXPIRED', 'OPENING_STOCK', 'OTHER');

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "reason" "StockAdjustmentReason";

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_adjustments_tenantId_companyId_createdAt_idx" ON "stock_adjustments"("tenantId", "companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
