import bcrypt from 'bcrypt';
import { Role } from '@/generated/prisma/client';
import { prisma } from '../database/prisma';
import { audit } from '../audit/audit.service';
import { SessionUser } from '../auth/session';
import { badRequest, forbidden, notFound } from '../http/errors';

export async function listUsers(user: SessionUser) {
  if (![Role.ADMIN, Role.MAYOR, Role.GOVERNMENT_SECRETARY].includes(user.role)) throw forbidden();
  return prisma.user.findMany({
    select: {
      id: true,
      nome: true,
      matricula: true,
      role: true,
      ativo: true,
      createdAt: true,
      secretaria: { select: { id: true, nome: true, sigla: true } },
    },
    orderBy: { nome: 'asc' },
  });
}
export async function createUser(
  actor: SessionUser,
  data: { nome: string; matricula: string; senha: string; role: Role },
) {
  if (actor.role !== Role.ADMIN) throw forbidden();
  if (data.role === Role.DRIVER) throw badRequest('Use o cadastro de motoristas para este perfil.');
  if (await prisma.user.findUnique({ where: { matricula: data.matricula } }))
    throw badRequest('Já existe um usuário com esta matrícula.');
  const item = await prisma.user.create({
    data: {
      nome: data.nome.trim(),
      matricula: data.matricula.trim(),
      passwordHash: await bcrypt.hash(data.senha, 10),
      role: data.role,
    },
    select: {
      id: true,
      nome: true,
      matricula: true,
      role: true,
      ativo: true,
      createdAt: true,
      secretaria: true,
    },
  });
  await audit({
    userId: actor.id,
    action: 'CADASTROU_USUARIO',
    entity: 'User',
    entityId: item.id,
    newData: { nome: item.nome, matricula: item.matricula, role: item.role },
  });
  return item;
}
export async function getUserDetails(actor: SessionUser, id: number) {
  if (![Role.ADMIN, Role.MAYOR, Role.GOVERNMENT_SECRETARY].includes(actor.role)) throw forbidden();
  const item = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      matricula: true,
      role: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
      secretaria: true,
      auditLogs: { take: 30, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!item) throw notFound('Usuário não encontrado.');
  return { ...item, canResetPassword: canResetPassword(actor, item) };
}

type PasswordTarget = { id: number; role: Role; secretariaId?: number | null };

export function canResetPassword(actor: SessionUser, target: PasswordTarget) {
  if (actor.id === target.id) return false;
  if (actor.role === Role.ADMIN) return target.role !== Role.ADMIN;
  if (actor.role === Role.MAYOR)
    return [Role.GOVERNMENT_SECRETARY, Role.SECRETARY, Role.DRIVER].includes(target.role);
  if (actor.role === Role.GOVERNMENT_SECRETARY)
    return [Role.SECRETARY, Role.DRIVER].includes(target.role);
  return (
    actor.role === Role.SECRETARY &&
    target.role === Role.DRIVER &&
    actor.secretariaId === target.secretariaId
  );
}

export async function resetUserPassword(actor: SessionUser, id: number, password: string) {
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, nome: true, role: true, secretariaId: true, passwordHash: true },
  });
  if (!target) throw notFound('Usuário não encontrado.');
  if (!canResetPassword(actor, target))
    throw forbidden('Você não possui permissão para redefinir a senha deste usuário.');
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  await audit({
    userId: actor.id,
    action: 'REDEFINIU_SENHA_USUARIO',
    entity: 'User',
    entityId: id,
    description: `Senha de ${target.nome} redefinida por uma autoridade autorizada.`,
  });
  return { success: true };
}
