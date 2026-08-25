import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { startSession } from '@/server/fleet/fleet.service';
import { routeError } from '@/server/http/response';
const schema = z.object({
  vehicleId: z.number().int().positive(),
  startKm: z.number().int().nonnegative(),
  startPhoto: z.string().min(1),
  startLatitude: z.number().min(-90).max(90),
  startLongitude: z.number().min(-180).max(180),
  startNote: z.string().optional(),
});
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await startSession(await requireUser(request), schema.parse(await request.json())),
      { status: 201 },
    );
  } catch (e) {
    return routeError(e);
  }
}
