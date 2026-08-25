import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { finishSession } from '@/server/fleet/fleet.service';
import { routeError } from '@/server/http/response';
const schema = z.object({
  endKm: z.number().int().nonnegative(),
  endPhoto: z.string().min(1),
  endLatitude: z.number().min(-90).max(90),
  endLongitude: z.number().min(-180).max(180),
  endNote: z.string().optional(),
});
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(
      await finishSession(
        await requireUser(request),
        Number((await params).id),
        schema.parse(await request.json()),
      ),
    );
  } catch (e) {
    return routeError(e);
  }
}
