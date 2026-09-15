-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "unitId" UUID;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
