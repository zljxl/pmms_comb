import { Role } from '@/generated/prisma/client';
import { jwtVerify, SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { prisma } from '../database/prisma';
import { HttpError } from '../http/errors';
export type SessionUser = {
  id: number;
  matricula: string;
  nome: string;
  role: Role;
  secretariaId: number | null;
};
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');
export async function createToken(user: SessionUser) {
  return new SignJWT({
    matricula: user.matricula,
    role: user.role,
    secretariaId: user.secretariaId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret());
}
export async function requireUser(request: NextRequest): Promise<SessionUser> {
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) throw new HttpError(401, 'Sessão não autenticada.');
  try {
    const { payload } = await jwtVerify(bearer.slice(7), secret());
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: {
        id: true,
        matricula: true,
        nome: true,
        role: true,
        secretariaId: true,
        ativo: true,
      },
    });
    if (!user?.ativo) throw new Error();
    const { ativo: _, ...safe } = user;
    return safe;
  } catch {
    throw new HttpError(401, 'Sessão inválida ou expirada.');
  }
}
