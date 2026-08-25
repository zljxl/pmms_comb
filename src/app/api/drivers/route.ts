import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { createDriver, listDrivers } from '@/server/drivers/drivers.service';
import { routeError } from '@/server/http/response';

const createSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo.'),
  matricula: z.string().trim().min(3, 'Informe uma matrícula válida.').max(30),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  secretariaId: z.number().int().positive().optional(),
});

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listDrivers(await requireUser(request)));
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const data = createSchema.parse(await request.json());
    return NextResponse.json(await createDriver(user, data), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
