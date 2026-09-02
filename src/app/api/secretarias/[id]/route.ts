import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { z } from 'zod';
import {
  changeSecretariaSecretary,
  getSecretariaDetails,
  setSecretariaStatus,
} from '@/server/administration/administration.service';
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

const schema = z.union([
  z.object({ secretarioId: z.number().int().positive() }),
  z.object({ ativo: z.boolean() }),
]);

export async function PATCH(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = schema.parse(await r.json());
    const user = await requireUser(r);
    const id = Number((await params).id);
    return NextResponse.json(
      'ativo' in data
        ? await setSecretariaStatus(user, id, data.ativo)
        : await changeSecretariaSecretary(user, id, data.secretarioId),
    );
  } catch (e) {
    return routeError(e);
  }
}
