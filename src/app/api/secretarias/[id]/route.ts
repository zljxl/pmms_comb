import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { getSecretariaDetails } from '@/server/administration/administration.service';
import { routeError } from '@/server/http/response';
export async function GET(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(
      await getSecretariaDetails(await requireUser(r), Number((await params).id)),
    );
  } catch (e) {
    return routeError(e);
  }
}
