import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { getUserDetails, setUserStatus } from '@/server/users/users.service';
import { routeError } from '@/server/http/response';

const updateSchema = z.object({ ativo: z.boolean() });

export async function GET(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await getUserDetails(await requireUser(r), Number((await params).id)));
  } catch (e) {
    return routeError(e);
  }
}

export async function PATCH(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ativo } = updateSchema.parse(await r.json());
    return NextResponse.json(
      await setUserStatus(await requireUser(r), Number((await params).id), ativo),
    );
  } catch (e) {
    return routeError(e);
  }
}
