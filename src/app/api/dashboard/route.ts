import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { dashboard } from '@/server/dashboard/dashboard.service';
import { routeError } from '@/server/http/response';
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await dashboard(await requireUser(request)));
  } catch (e) {
    return routeError(e);
  }
}
