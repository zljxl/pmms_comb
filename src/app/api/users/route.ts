import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import { requireUser } from '@/server/auth/session';
import { createUser, listUsers } from '@/server/users/users.service';
import { routeError } from '@/server/http/response';
const schema = z.object({
  nome: z.string().trim().min(3),
  matricula: z.string().trim().min(3).max(30),
  senha: z.string().min(6),
  role: z.nativeEnum(Role),
});
export async function GET(r: NextRequest) {
  try {
    return NextResponse.json(await listUsers(await requireUser(r)));
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(r: NextRequest) {
  try {
    return NextResponse.json(await createUser(await requireUser(r), schema.parse(await r.json())), {
      status: 201,
    });
  } catch (e) {
    return routeError(e);
  }
}
