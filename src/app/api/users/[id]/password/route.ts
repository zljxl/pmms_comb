import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { resetUserPassword } from '@/server/users/users.service';
import { routeError } from '@/server/http/response';

const schema = z.object({ password: z.string().min(8).max(128) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { password } = schema.parse(await request.json());
    return NextResponse.json(
      await resetUserPassword(await requireUser(request), Number(id), password),
    );
  } catch (error) {
    return routeError(error);
  }
}
