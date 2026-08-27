-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "isDefaultTrial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "isComplimentary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "plans_isDefaultTrial_idx" ON "plans"("isDefaultTrial");
