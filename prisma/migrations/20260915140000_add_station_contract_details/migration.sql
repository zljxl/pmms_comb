ALTER TABLE "GasStation"
ADD COLUMN "contractProcessNumber" TEXT,
ADD COLUMN "contractObject" TEXT,
ADD COLUMN "contractStartDate" TIMESTAMP(3),
ADD COLUMN "contractEndDate" TIMESTAMP(3),
ADD COLUMN "contractAmountLimit" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX "GasStation_contractStartDate_contractEndDate_active_idx"
ON "GasStation"("contractStartDate", "contractEndDate", "active");
