-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "unitId" UUID;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
