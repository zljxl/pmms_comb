import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { z } from 'zod';
import { changeSecretariaSecretary, getSecretariaDetails } from '@/server/administration/administration.service';
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

const schema = z.object({ secretarioId: z.number().int().positive() });

export async function PATCH(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = schema.parse(await r.json());
    return NextResponse.json(
      await changeSecretariaSecretary(await requireUser(r), Number((await params).id), data.secretarioId),
    );
  } catch (e) {
    return routeError(e);
  }
}
