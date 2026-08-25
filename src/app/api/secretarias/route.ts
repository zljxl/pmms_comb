import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { createSecretaria, listSecretarias } from '@/server/administration/administration.service';
import { routeError } from '@/server/http/response';
const schema = z.object({
  nome: z.string().trim().min(3),
  sigla: z.string().trim().max(12).optional(),
  secretarioId: z.number().int().positive(),
});
export async function GET(r: NextRequest) {
  try {
    return NextResponse.json(await listSecretarias(await requireUser(r)));
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(r: NextRequest) {
  try {
    return NextResponse.json(
      await createSecretaria(await requireUser(r), schema.parse(await r.json())),
      { status: 201 },
    );
  } catch (e) {
    return routeError(e);
  }
}
