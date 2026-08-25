import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { listAvailableVehicles } from '@/server/fleet/fleet.service';
import { routeError } from '@/server/http/response';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listAvailableVehicles(await requireUser(request)));
  } catch (error) {
    return routeError(error);
  }
}
