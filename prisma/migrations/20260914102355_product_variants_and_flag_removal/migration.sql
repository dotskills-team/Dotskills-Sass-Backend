-- DropIndex
DROP INDEX "inventory_tenantId_companyId_locationId_productId_key";

-- AlterTable
ALTER TABLE "company_settings" DROP COLUMN "enableComboOffer",
DROP COLUMN "enableProductVariant";

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "variantId" UUID;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "hasVariants" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "variantId" UUID;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "variantId" UUID;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "variantId" UUID;

-- AlterTable
ALTER TABLE "stock_transfers" ADD COLUMN     "variantId" UUID;

-- CreateTable
CREATE TABLE "variant_attributes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_attribute_values" (
    "id" UUID NOT NULL,
    "attributeId" UUID NOT NULL,
    "value" VARCHAR(80) NOT NULL,

    CONSTRAINT "variant_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "barcode" VARCHAR(64),
    "costPrice" DECIMAL(20,4) NOT NULL,
    "salePrice" DECIMAL(20,4) NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_attribute_values" (
    "variantId" UUID NOT NULL,
    "attributeValueId" UUID NOT NULL,

    CONSTRAINT "product_variant_attribute_values_pkey" PRIMARY KEY ("variantId","attributeValueId")
);

-- CreateIndex
CREATE UNIQUE INDEX "variant_attributes_tenantId_companyId_name_key" ON "variant_attributes"("tenantId", "companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "variant_attribute_values_attributeId_value_key" ON "variant_attribute_values"("attributeId", "value");

-- CreateIndex
CREATE INDEX "product_variants_tenantId_companyId_productId_status_idx" ON "product_variants"("tenantId", "companyId", "productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_tenantId_companyId_sku_key" ON "product_variants"("tenantId", "companyId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_tenantId_companyId_barcode_key" ON "product_variants"("tenantId", "companyId", "barcode");

-- CreateIndex
CREATE INDEX "inventory_tenantId_companyId_locationId_productId_variantId_idx" ON "inventory"("tenantId", "companyId", "locationId", "productId", "variantId");

-- AddForeignKey
ALTER TABLE "variant_attributes" ADD CONSTRAINT "variant_attributes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_attributes" ADD CONSTRAINT "variant_attributes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_attribute_values" ADD CONSTRAINT "variant_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "variant_attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_attribute_values" ADD CONSTRAINT "product_variant_attribute_values_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_attribute_values" ADD CONSTRAINT "product_variant_attribute_values_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "variant_attribute_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Enforce Inventory uniqueness for both non-variant and variant rows.
-- Postgres unique indexes treat NULL as distinct from every other NULL, so
-- a single composite unique index including nullable variantId would NOT
-- stop duplicate rows for non-variant products (variantId always null).
-- Two partial unique indexes cover both cases explicitly.
CREATE UNIQUE INDEX "inventory_no_variant_unique" ON "inventory"("tenantId", "companyId", "locationId", "productId") WHERE "variantId" IS NULL;
CREATE UNIQUE INDEX "inventory_variant_unique" ON "inventory"("tenantId", "companyId", "locationId", "productId", "variantId") WHERE "variantId" IS NOT NULL;
