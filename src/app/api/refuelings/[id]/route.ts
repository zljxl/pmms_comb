import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { getRefuelingDetails, rectifyRefueling } from '@/server/refuelings/refuelings.service';
import { routeError } from '@/server/http/response';
const schema = z.object({
  km: z.number().int().nonnegative().optional(),
  liters: z.number().positive().optional(),
  pricePerLiter: z.number().positive().optional(),
  fuelStation: z.string().optional(),
  pumpPhoto: z.string().optional(),
  odometerPhoto: z.string().optional(),
  receiptPhoto: z.string().optional(),
  observation: z.string().optional(),
});
export async function GET(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(
      await getRefuelingDetails(await requireUser(r), Number((await params).id)),
    );
  } catch (e) {
    return routeError(e);
  }
}
export async function PATCH(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(
      await rectifyRefueling(
        await requireUser(r),
        Number((await params).id),
        schema.parse(await r.json()),
      ),
    );
  } catch (e) {
    return routeError(e);
  }
}
