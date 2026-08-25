import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { setStationAllowance } from '@/server/stations/stations.service';
import { routeError } from '@/server/http/response';

const schema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  litersLimit: z.number().positive(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(
      await setStationAllowance(
        await requireUser(request),
        Number(id),
        schema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}
