-- CreateIndex

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sale_items_productId_saleId_idx"
  ON "sale_items" ("productId", "saleId");