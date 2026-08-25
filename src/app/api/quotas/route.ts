import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import {
  listQuotas,
  setGeneralQuota,
  setQuota,
} from '@/server/administration/administration.service';
import { routeError } from '@/server/http/response';
const period = {
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  amountLimit: z.number().nonnegative(),
};
const schema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('GENERAL'), ...period }),
  z.object({
    scope: z.literal('SECRETARIA'),
    secretariaId: z.number().int().positive(),
    ...period,
  }),
]);
export async function GET(r: NextRequest) {
  try {
    const url = new URL(r.url),
      now = new Date(),
      year = Number(url.searchParams.get('year')) || now.getFullYear(),
      month = Number(url.searchParams.get('month')) || now.getMonth() + 1;
    return NextResponse.json(await listQuotas(await requireUser(r), year, month));
  } catch (e) {
    return routeError(e);
  }
}
export async function POST(r: NextRequest) {
  try {
    const user = await requireUser(r);
    const data = schema.parse(await r.json());
    if (data.scope === 'GENERAL') {
      return NextResponse.json(
        await setGeneralQuota(user, {
          year: data.year,
          month: data.month,
          amountLimit: data.amountLimit,
        }),
      );
    }
    return NextResponse.json(
      await setQuota(user, {
        secretariaId: data.secretariaId,
        year: data.year,
        month: data.month,
        amountLimit: data.amountLimit,
      }),
    );
  } catch (e) {
    return routeError(e);
  }
}
