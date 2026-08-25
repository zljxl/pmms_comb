import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { currentSession } from '@/server/fleet/fleet.service';
import { routeError } from '@/server/http/response';
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await currentSession(await requireUser(request)));
  } catch (e) {
    return routeError(e);
  }
}
