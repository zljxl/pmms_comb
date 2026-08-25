import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/server/audit/audit.service';
import { createToken } from '@/server/auth/session';
import { prisma } from '@/server/database/prisma';
import { routeError } from '@/server/http/response';
import { HttpError } from '@/server/http/errors';
const schema = z.object({ matricula: z.string().min(1), senha: z.string().min(6) });
export async function POST(request: NextRequest) {
  try {
    const data = schema.parse(await request.json());
    let found = await prisma.user.findUnique({
      where: { matricula: data.matricula },
      include: { secretaria: { select: { id: true, nome: true, sigla: true } } },
    });

    if (!found) {
      const passwordHash = await bcrypt.hash(data.senha, 12);
      found = await prisma.$transaction(async tx => {
        const existing = await tx.user.findUnique({
          where: { matricula: data.matricula },
          include: { secretaria: { select: { id: true, nome: true, sigla: true } } },
        });
        if (existing) return existing;

        const firstUser = await tx.user.findFirst({ select: { id: true } });
        if (firstUser) return null;

        return tx.user.create({
          data: {
            matricula: data.matricula,
            nome: 'Administrador do Sistema',
            passwordHash,
            role: 'ADMIN',
          },
          include: { secretaria: { select: { id: true, nome: true, sigla: true } } },
        });
      });
    }

    if (!found?.ativo || !(await bcrypt.compare(data.senha, found.passwordHash))) {
      await audit({
        action: 'LOGIN_INVALIDO',
        entity: 'User',
        entityId: found?.id,
        description: `Matrícula: ${data.matricula}`,
      });
      throw new HttpError(401, 'Matrícula ou senha inválida.');
    }
    const user = {
      id: found.id,
      matricula: found.matricula,
      nome: found.nome,
      role: found.role,
      secretariaId: found.secretariaId,
      secretaria: found.secretaria,
    };
    await audit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id });
    return NextResponse.json({ accessToken: await createToken(user), user });
  } catch (e) {
    return routeError(e);
  }
}
