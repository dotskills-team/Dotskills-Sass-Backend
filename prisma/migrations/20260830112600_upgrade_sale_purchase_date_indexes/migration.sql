-- DropIndex
DROP INDEX "purchase_orders_tenantId_companyId_status_idx";

-- DropIndex
DROP INDEX "sales_tenantId_companyId_status_idx";

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_companyId_status_orderDate_idx" ON "purchase_orders"("tenantId", "companyId", "status", "orderDate");

-- CreateIndex
CREATE INDEX "sales_tenantId_companyId_status_saleDate_idx" ON "sales"("tenantId", "companyId", "status", "saleDate");
