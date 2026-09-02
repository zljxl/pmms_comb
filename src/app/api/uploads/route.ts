import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { badRequest } from '@/server/http/errors';
import { routeError } from '@/server/http/response';
import { uploadObject } from '@/server/storage/r2';

export const runtime = 'nodejs';
const allowed = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw badRequest('Selecione uma imagem.');
    const extension = allowed.get(file.type);
    if (!extension) throw badRequest('Formato inválido. Use JPG, PNG ou WebP.');
    if (file.size > 8 * 1024 * 1024) throw badRequest('A imagem deve ter no máximo 8 MB.');
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    const key = `evidencias/${user.id}/${date}/${filename}`;
    const url = await uploadObject({
      key,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    });
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
