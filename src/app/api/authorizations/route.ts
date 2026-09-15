import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import {
  createAuthorization,
  listAuthorizations,
} from '@/server/authorizations/authorizations.service';
import { routeError } from '@/server/http/response';

const schema = z.object({
  number: z.string().trim().max(100).optional(),
  secretariaId: z.number().int().positive(),
  stationId: z.number().int().positive(),
  fuelType: z.enum(['GASOLINA', 'ETANOL', 'DIESEL_S10', 'DIESEL_S500']),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  amountLimit: z.number().positive(),
  litersLimit: z.number().positive().optional(),
  simple: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await listAuthorizations(
        await requireUser(request),
        Number(url.searchParams.get('year')) || undefined,
        Number(url.searchParams.get('month')) || undefined,
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await createAuthorization(await requireUser(request), schema.parse(await request.json())),
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
