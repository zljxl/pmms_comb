CREATE TABLE "SupplyAuthorization" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "secretariaId" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "fuelType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amountLimit" DOUBLE PRECISION NOT NULL,
    "litersLimit" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplyAuthorization_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Refueling" ADD COLUMN "authorizationId" INTEGER;
CREATE UNIQUE INDEX "SupplyAuthorization_number_key" ON "SupplyAuthorization"("number");
CREATE INDEX "SupplyAuthorization_secretariaId_year_month_active_idx" ON "SupplyAuthorization"("secretariaId", "year", "month", "active");
CREATE INDEX "SupplyAuthorization_stationId_fuelType_idx" ON "SupplyAuthorization"("stationId", "fuelType");
CREATE INDEX "Refueling_authorizationId_idx" ON "Refueling"("authorizationId");
ALTER TABLE "SupplyAuthorization" ADD CONSTRAINT "SupplyAuthorization_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyAuthorization" ADD CONSTRAINT "SupplyAuthorization_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GasStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refueling" ADD CONSTRAINT "Refueling_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "SupplyAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
