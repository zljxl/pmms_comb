import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { changeVehicleLotacao, getVehicleDetails } from '@/server/fleet/fleet.service';
import { routeError } from '@/server/http/response';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await getVehicleDetails(await requireUser(request), Number(id)));
  } catch (error) {
    return routeError(error);
  }
}

const updateSchema = z.object({ secretariaId: z.number().int().positive() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = updateSchema.parse(await request.json());
    return NextResponse.json(
      await changeVehicleLotacao(await requireUser(request), Number(id), data.secretariaId),
    );
  } catch (error) {
    return routeError(error);
  }
}
