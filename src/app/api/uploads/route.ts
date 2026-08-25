import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { badRequest } from '@/server/http/errors';
import { routeError } from '@/server/http/response';

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
    const relativeDirectory = path.join('uploads', 'evidencias', String(user.id), date);
    const directory = path.join(process.cwd(), 'public', relativeDirectory);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()), {
      flag: 'wx',
    });
    return NextResponse.json(
      { url: `/${relativeDirectory.split(path.sep).join('/')}/${filename}` },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
