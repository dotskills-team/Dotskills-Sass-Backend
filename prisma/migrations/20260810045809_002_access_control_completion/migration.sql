-- CreateEnum
CREATE TYPE "CompanyScopeType" AS ENUM ('COMPANY', 'BRANCH', 'WAREHOUSE', 'POS_COUNTER');

-- CreateTable
CREATE TABLE "company_member_scopes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "companyMemberId" UUID NOT NULL,
    "scopeType" "CompanyScopeType" NOT NULL,
    "scopeKey" VARCHAR(120) NOT NULL DEFAULT '*',
    "conditions" JSONB,
    "validFrom" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMPTZ(6),
    "assignedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_member_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_member_scopes_tenantId_companyId_scopeType_scopeKey_idx" ON "company_member_scopes"("tenantId", "companyId", "scopeType", "scopeKey", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "company_member_scopes_companyMemberId_scopeType_scopeKey_key" ON "company_member_scopes"("companyMemberId", "scopeType", "scopeKey");

-- AddForeignKey
ALTER TABLE "company_member_scopes" ADD CONSTRAINT "company_member_scopes_companyMemberId_fkey" FOREIGN KEY ("companyMemberId") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
