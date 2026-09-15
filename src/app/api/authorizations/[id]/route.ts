import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { deleteAuthorization } from '@/server/authorizations/authorizations.service';
import { routeError } from '@/server/http/response';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await deleteAuthorization(await requireUser(request), Number(id)));
  } catch (error) {
    return routeError(error);
  }
}
