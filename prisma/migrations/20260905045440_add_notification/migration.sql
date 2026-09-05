-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('OUT_OF_STOCK', 'LOW_STOCK', 'CASH_DRAWER_VARIANCE', 'CUSTOMER_DUE_OVERDUE', 'SUPPLIER_PAYABLE_OVERDUE', 'SUBSCRIPTION_EXPIRING_SOON', 'SUBSCRIPTION_PAST_DUE', 'STAFF_ACTIVITY');

-- CreateEnum
CREATE TYPE "NotificationRelatedEntityType" AS ENUM ('PRODUCT', 'CASH_DRAWER_SESSION', 'CUSTOMER', 'SUPPLIER', 'SUBSCRIPTION', 'COMPANY_MEMBER');

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "maxSupplierPayableLimit" DECIMAL(20,4);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "relatedEntityType" "NotificationRelatedEntityType" NOT NULL,
    "relatedEntityId" UUID NOT NULL,
    "locationId" UUID,
    "metadata" JSONB NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_tenantId_companyId_isRead_createdAt_idx" ON "notifications"("tenantId", "companyId", "isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
