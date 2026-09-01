import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { changeDriverLotacao, getDriverDetails } from '@/server/drivers/drivers.service';
import { routeError } from '@/server/http/response';

const updateSchema = z.object({ secretariaId: z.number().int().positive() });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await getDriverDetails(await requireUser(request), Number(id)));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = updateSchema.parse(await request.json());
    return NextResponse.json(
      await changeDriverLotacao(await requireUser(request), Number(id), data.secretariaId),
    );
  } catch (error) {
    return routeError(error);
  }
}
