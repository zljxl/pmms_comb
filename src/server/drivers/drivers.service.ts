import bcrypt from 'bcryptjs';
import { Role } from '@/generated/prisma/client';
import { prisma } from '../database/prisma';
import { audit } from '../audit/audit.service';
import { SessionUser } from '../auth/session';
import { badRequest, forbidden, notFound } from '../http/errors';
import { canResetPassword } from '../users/users.service';

export type CreateDriver = {
  nome: string;
  matricula: string;
  senha: string;
  secretariaId?: number;
};

const canManage = (role: Role) =>
  role === Role.ADMIN || role === Role.SECRETARY || role === Role.GOVERNMENT_SECRETARY;

export async function listDrivers(user: SessionUser) {
  if (user.role === Role.DRIVER) throw forbidden();
  const restricted = user.role === Role.SECRETARY;
  const where = restricted
    ? { role: Role.DRIVER, secretariaId: user.secretariaId! }
    : { role: Role.DRIVER };
  const [drivers, secretarias] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        nome: true,
        matricula: true,
        ativo: true,
        createdAt: true,
        secretaria: { select: { id: true, nome: true, sigla: true } },
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.secretaria.findMany({
      where: { ativo: true, ...(restricted ? { id: user.secretariaId! } : {}) },
      select: { id: true, nome: true, sigla: true },
      orderBy: { nome: 'asc' },
    }),
  ]);
  return { drivers, secretarias, canCreate: canManage(user.role) };
}

export async function createDriver(user: SessionUser, data: CreateDriver) {
  if (!canManage(user.role))
    throw forbidden('Você não possui permissão para cadastrar motoristas.');
  const secretariaId = user.role === Role.SECRETARY ? user.secretariaId : data.secretariaId;
  if (!secretariaId) throw badRequest('Informe a secretaria do motorista.');
  const secretaria = await prisma.secretaria.findFirst({
    where: { id: secretariaId, ativo: true },
  });
  if (!secretaria) throw notFound('Secretaria não encontrada.');
  if (await prisma.user.findUnique({ where: { matricula: data.matricula } }))
    throw badRequest('Já existe um usuário com esta matrícula.');
  const driver = await prisma.user.create({
    data: {
      nome: data.nome.trim(),
      matricula: data.matricula.trim(),
      passwordHash: await bcrypt.hash(data.senha, 10),
      role: Role.DRIVER,
      secretariaId,
    },
    select: {
      id: true,
      nome: true,
      matricula: true,
      ativo: true,
      createdAt: true,
      secretaria: { select: { id: true, nome: true, sigla: true } },
    },
  });
  await audit({
    userId: user.id,
    action: 'CADASTROU_MOTORISTA',
    entity: 'User',
    entityId: driver.id,
    newData: { nome: driver.nome, matricula: driver.matricula, secretariaId },
  });
  return { ...driver, canResetPassword: canResetPassword(user, { ...driver, role: Role.DRIVER }) };
}

export async function getDriverDetails(user: SessionUser, id: number) {
  if (user.role === Role.DRIVER) throw forbidden();
  const driver = await prisma.user.findFirst({
    where: { id, role: Role.DRIVER },
    select: {
      id: true,
      nome: true,
      matricula: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
      secretariaId: true,
      secretaria: { select: { id: true, nome: true, sigla: true } },
      sessions: {
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: { vehicle: { select: { id: true, placa: true, marca: true, modelo: true } } },
      },
      refuelings: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { vehicle: { select: { id: true, placa: true, marca: true, modelo: true } } },
      },
    },
  });
  if (!driver) throw notFound('Motorista não encontrado.');
  if (user.role === Role.SECRETARY && driver.secretariaId !== user.secretariaId) throw forbidden();
  return driver;
}
