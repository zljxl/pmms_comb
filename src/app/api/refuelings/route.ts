import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { createRefueling, listRefuelings } from '@/server/refuelings/refuelings.service';
import { routeError } from '@/server/http/response';
const schema = z.object({
  sessionId: z.number().int().positive().optional(),
  driverId: z.number().int().positive().optional(),
  vehicleId: z.number().int().positive(),
  km: z.number().int().nonnegative(),
  liters: z.number().positive(),
  pricePerLiter: z.number().positive(),
  totalAmount: z.number().positive().optional(),
  fuelType: z.string().min(1),
  stationId: z.number().int().positive().optional(),
  fuelStation: z.string().min(2).optional(),
  pumpPhoto: z.string().min(1).optional(),
  odometerPhoto: z.string().min(1).optional(),
  receiptPhoto: z.string().min(1),
  observation: z.string().optional(),
  refueledAt: z.coerce.date().optional(),
});
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listRefuelings(await requireUser(request)));
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await createRefueling(await requireUser(request), schema.parse(await request.json())),
      { status: 201 },
    );
  } catch (e) {
    return routeError(e);
  }
}
