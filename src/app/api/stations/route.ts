import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { createStation, listStations } from '@/server/stations/stations.service';
import { routeError } from '@/server/http/response';

const optionalPrice = z.number().positive().optional();
const schema = z
  .object({
    name: z.string().trim().min(2),
    legalName: z.string().trim().min(3),
    cnpj: z.string().trim().min(14).max(18),
    phone: z.string().trim().max(20).optional(),
    contractNumber: z.string().trim().max(60).optional(),
    address: z.string().trim().min(5),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    gasolinePrice: optionalPrice,
    ethanolPrice: optionalPrice,
    dieselS10Price: optionalPrice,
    dieselS500Price: optionalPrice,
    contractLitersLimit: z.number().positive(),
  })
  .refine(
    data => data.gasolinePrice || data.ethanolPrice || data.dieselS10Price || data.dieselS500Price,
    'Informe ao menos um preço.',
  );

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listStations(await requireUser(request)));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await createStation(await requireUser(request), schema.parse(await request.json())),
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
