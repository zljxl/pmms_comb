import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { getVehicleDetails } from '@/server/fleet/fleet.service';
import { routeError } from '@/server/http/response';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await getVehicleDetails(await requireUser(request), Number(id)));
  } catch (error) {
    return routeError(error);
  }
}
