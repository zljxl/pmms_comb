import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { getUserDetails } from '@/server/users/users.service';
import { routeError } from '@/server/http/response';
export async function GET(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await getUserDetails(await requireUser(r), Number((await params).id)));
  } catch (e) {
    return routeError(e);
  }
}
