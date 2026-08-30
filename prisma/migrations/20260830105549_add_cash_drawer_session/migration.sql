-- CreateEnum
CREATE TYPE "CashDrawerSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cashDrawerSessionId" UUID;

-- CreateTable
CREATE TABLE "cash_drawer_sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "cashierId" UUID NOT NULL,
    "status" "CashDrawerSessionStatus" NOT NULL DEFAULT 'OPEN',
    "shiftStart" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftEnd" TIMESTAMPTZ(6),
    "openingBalance" DECIMAL(20,4) NOT NULL,
    "expectedClosingBalance" DECIMAL(20,4),
    "actualClosingBalance" DECIMAL(20,4),
    "variance" DECIMAL(20,4),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cash_drawer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_drawer_sessions_tenantId_companyId_locationId_status_idx" ON "cash_drawer_sessions"("tenantId", "companyId", "locationId", "status");

-- CreateIndex
-- Partial unique index (hand-edited from Prisma's generated plain unique
-- index): only one OPEN CashDrawerSession per cashier at a time, enforced
-- atomically by Postgres itself rather than an application-level
-- check-then-create (which would race under concurrent opens). A cashier
-- may have any number of CLOSED sessions with the same (tenantId,
-- companyId, cashierId) — the WHERE clause is what makes this a
-- "at most one OPEN" constraint instead of a global uniqueness constraint.
CREATE UNIQUE INDEX "cash_drawer_sessions_one_open_per_cashier" ON "cash_drawer_sessions"("tenantId", "companyId", "cashierId") WHERE "status" = 'OPEN';

-- CreateIndex
CREATE INDEX "sales_cashDrawerSessionId_idx" ON "sales"("cashDrawerSessionId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashDrawerSessionId_fkey" FOREIGN KEY ("cashDrawerSessionId") REFERENCES "cash_drawer_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
