-- CreateTable
CREATE TABLE "purchase_order_sequences" (
    "tenantId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "yearKey" VARCHAR(4) NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_sequences_pkey" PRIMARY KEY ("tenantId","companyId","yearKey")
);
