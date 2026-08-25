import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { createVehicle, listVehicles } from '@/server/fleet/fleet.service';
import { routeError } from '@/server/http/response';
const schema = z.object({
  placa: z.string().min(7).max(8),
  patrimonio: z.string().optional(),
  marca: z.string().trim().min(2),
  modelo: z.string().trim().min(1),
  ano: z.number().int().min(1950).max(2100).optional(),
  fuelType: z.string().optional(),
  tankCapacity: z.number().positive().optional(),
  currentKm: z.number().int().nonnegative(),
  secretariaId: z.number().int().positive().optional(),
});
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listVehicles(await requireUser(request)));
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await createVehicle(await requireUser(request), schema.parse(await request.json())),
      { status: 201 },
    );
  } catch (e) {
    return routeError(e);
  }
}
