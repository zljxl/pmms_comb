import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { getDriverDetails } from '@/server/drivers/drivers.service';
import { routeError } from '@/server/http/response';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await getDriverDetails(await requireUser(request), Number(id)));
  } catch (error) {
    return routeError(error);
  }
}
