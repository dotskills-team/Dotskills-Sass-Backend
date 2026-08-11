/*
  Warnings:

  - The `status` column on the `company_roles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `features` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `industries` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `permissions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `platform_roles` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IndustryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PermissionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "company_roles" DROP COLUMN "status",
ADD COLUMN     "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "features" DROP COLUMN "status",
ADD COLUMN     "status" "FeatureStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "industries" DROP COLUMN "status",
ADD COLUMN     "status" "IndustryStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "permissions" DROP COLUMN "status",
ADD COLUMN     "status" "PermissionStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "platform_roles" DROP COLUMN "status",
ADD COLUMN     "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "company_roles_tenantId_companyId_status_idx" ON "company_roles"("tenantId", "companyId", "status");

-- CreateIndex
CREATE INDEX "features_module_status_idx" ON "features"("module", "status");

-- CreateIndex
CREATE INDEX "permissions_moduleCode_status_idx" ON "permissions"("moduleCode", "status");

-- CreateIndex
CREATE INDEX "permissions_resource_action_status_idx" ON "permissions"("resource", "action", "status");

-- CreateIndex
CREATE INDEX "platform_roles_status_idx" ON "platform_roles"("status");
