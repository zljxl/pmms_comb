import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { getStationDetails, updateStation } from '@/server/stations/stations.service';
import { routeError } from '@/server/http/response';

const schema = z.object({
  name: z.string().min(2),
  legalName: z.string().min(2),
  cnpj: z.string().min(14),
  phone: z.string().optional(),
  contractNumber: z.string().optional(),
  address: z.string().min(3),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gasolinePrice: z.number().positive().optional(),
  ethanolPrice: z.number().positive().optional(),
  dieselS10Price: z.number().positive().optional(),
  dieselS500Price: z.number().positive().optional(),
  contractLitersLimit: z.number().positive(),
  active: z.boolean(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await getStationDetails(await requireUser(request), Number(id)));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(
      await updateStation(
        await requireUser(request),
        Number(id),
        schema.parse(await request.json()),
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}
