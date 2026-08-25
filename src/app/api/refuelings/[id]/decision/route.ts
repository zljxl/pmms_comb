import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { decideRefueling } from '@/server/refuelings/refuelings.service';
import { routeError } from '@/server/http/response';
const schema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'RETURNED']),
  observation: z.string().optional(),
});
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(
      await decideRefueling(
        await requireUser(request),
        Number((await params).id),
        schema.parse(await request.json()),
      ),
    );
  } catch (e) {
    return routeError(e);
  }
}
