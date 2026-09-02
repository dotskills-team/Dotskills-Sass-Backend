-- CreateTable
CREATE TABLE "company_member_locations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "companyMemberId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "assignedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_member_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_member_locations_tenantId_companyId_companyMemberId_idx" ON "company_member_locations"("tenantId", "companyId", "companyMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "company_member_locations_companyMemberId_locationId_key" ON "company_member_locations"("companyMemberId", "locationId");

-- AddForeignKey
ALTER TABLE "company_member_locations" ADD CONSTRAINT "company_member_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_member_locations" ADD CONSTRAINT "company_member_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_member_locations" ADD CONSTRAINT "company_member_locations_companyMemberId_fkey" FOREIGN KEY ("companyMemberId") REFERENCES "company_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_member_locations" ADD CONSTRAINT "company_member_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
