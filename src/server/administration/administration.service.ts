import { Role } from '@/generated/prisma/client';
import { SessionUser } from '../auth/session';
import { prisma } from '../database/prisma';
import { audit } from '../audit/audit.service';
import { badRequest, forbidden, notFound } from '../http/errors';

export async function listSecretarias(user: SessionUser) {
  if (user.role === Role.DRIVER) throw forbidden();
  const items = await prisma.secretaria.findMany({
    where: {
      ...(user.role === Role.ADMIN ? {} : { ativo: true }),
      ...(user.role === Role.SECRETARY ? { id: { in: user.secretariaIds } } : {}),
    },
    include: {
      secretario: { select: { id: true, nome: true, matricula: true, ativo: true } },
      _count: { select: { usuarios: true, veiculos: true } },
    },
    orderBy: { nome: 'asc' },
  });
  return items.map(item => ({
    ...item,
    secretario: user.role === Role.ADMIN || item.secretario?.ativo ? item.secretario : null,
  }));
}
export async function createSecretaria(
  user: SessionUser,
  data: { nome: string; sigla?: string; secretarioId: number },
) {
  if (user.role !== Role.ADMIN)
    throw forbidden('Somente administradores podem cadastrar secretarias.');
  if (await prisma.secretaria.findFirst({ where: { nome: data.nome.trim() } }))
    throw badRequest('Já existe uma secretaria com este nome.');
  const secretary = await prisma.user.findFirst({
    where: { id: data.secretarioId, role: Role.SECRETARY, ativo: true },
  });
  if (!secretary) throw notFound('Usuário secretário não encontrado.');
  return prisma.$transaction(async tx => {
    const item = await tx.secretaria.create({
      data: {
        nome: data.nome.trim(),
        sigla: data.sigla?.trim().toUpperCase() || null,
        secretarioId: secretary.id,
      },
    });
    if (!secretary.secretariaId)
      await tx.user.update({ where: { id: secretary.id }, data: { secretariaId: item.id } });
    await audit(
      {
        userId: user.id,
        action: 'CADASTROU_SECRETARIA',
        entity: 'Secretaria',
        entityId: item.id,
        newData: { ...item, secretarioId: secretary.id },
      },
      tx,
    );
    return item;
  });
}
export async function getSecretariaDetails(user: SessionUser, id: number) {
  if (
    user.role === Role.DRIVER ||
    (user.role === Role.SECRETARY && !user.secretariaIds.includes(id))
  )
    throw forbidden();
  const item = await prisma.secretaria.findFirst({
    where: { id, ...(user.role === Role.ADMIN ? {} : { ativo: true }) },
    include: {
      secretario: { select: { id: true, nome: true, matricula: true, ativo: true } },
      usuarios: { select: { id: true, nome: true, matricula: true, role: true, ativo: true } },
      veiculos: { orderBy: { placa: 'asc' } },
      quotas: { take: 12, orderBy: [{ year: 'desc' }, { month: 'desc' }] },
      refuelings: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { nome: true } }, vehicle: { select: { placa: true } } },
      },
    },
  });
  if (!item) throw notFound('Secretaria não encontrada.');
  const secretarios =
    user.role === Role.ADMIN
      ? await prisma.user.findMany({
          where: { role: Role.SECRETARY, ativo: true },
          select: { id: true, nome: true, matricula: true },
          orderBy: { nome: 'asc' },
        })
      : [];
  return {
    ...item,
    secretario: user.role === Role.ADMIN || item.secretario?.ativo ? item.secretario : null,
    usuarios:
      user.role === Role.ADMIN ? item.usuarios : item.usuarios.filter(usuario => usuario.ativo),
    secretarios,
    canChangeSecretary: user.role === Role.ADMIN,
    canManageStatus: user.role === Role.ADMIN,
  };
}

export async function setSecretariaStatus(user: SessionUser, id: number, ativo: boolean) {
  if (user.role !== Role.ADMIN)
    throw forbidden('Somente administradores podem alterar a situação de secretarias.');
  const old = await prisma.secretaria.findUnique({ where: { id } });
  if (!old) throw notFound('Secretaria não encontrada.');
  if (old.ativo === ativo) return old;

  const item = await prisma.secretaria.update({ where: { id }, data: { ativo } });
  await audit({
    userId: user.id,
    action: ativo ? 'ATIVOU_SECRETARIA' : 'DESATIVOU_SECRETARIA',
    entity: 'Secretaria',
    entityId: id,
    oldData: old,
    newData: item,
  });
  return item;
}

export async function changeSecretariaSecretary(
  user: SessionUser,
  id: number,
  secretarioId: number,
) {
  if (user.role !== Role.ADMIN)
    throw forbidden('Somente administradores podem trocar o secretário responsável.');
  const [secretaria, secretario] = await Promise.all([
    prisma.secretaria.findUnique({ where: { id }, include: { secretario: true } }),
    prisma.user.findFirst({ where: { id: secretarioId, role: Role.SECRETARY, ativo: true } }),
  ]);
  if (!secretaria) throw notFound('Secretaria não encontrada.');
  if (!secretario) throw notFound('Usuário secretário não encontrado.');
  const item = await prisma.secretaria.update({
    where: { id },
    data: { secretarioId },
    include: { secretario: { select: { id: true, nome: true, matricula: true } } },
  });
  if (!secretario.secretariaId)
    await prisma.user.update({ where: { id: secretario.id }, data: { secretariaId: id } });
  await audit({
    userId: user.id,
    action: 'TROCOU_SECRETARIO_SECRETARIA',
    entity: 'Secretaria',
    entityId: id,
    oldData: { secretarioId: secretaria.secretarioId },
    newData: { secretarioId },
  });
  return item;
}
export async function listQuotas(user: SessionUser, year: number, month: number) {
  if (user.role === Role.DRIVER) throw forbidden();
  const [secretarias, generalQuota] = await Promise.all([
    prisma.secretaria.findMany({
      where: {
        ativo: true,
        ...(user.role === Role.SECRETARY ? { id: { in: user.secretariaIds } } : {}),
      },
      include: { quotas: { where: { year, month }, take: 1 } },
      orderBy: { nome: 'asc' },
    }),
    prisma.municipalFuelQuota.findUnique({ where: { year_month: { year, month } } }),
  ]);
  const items = secretarias.map(({ quotas, ...s }) => ({
    ...s,
    amountLimit: quotas[0]?.amountLimit ?? 0,
    quotaId: quotas[0]?.id ?? null,
  }));
  const allocated = await prisma.fuelQuota.aggregate({
    where: { year, month },
    _sum: { amountLimit: true },
  });
  return {
    year,
    month,
    canManage: user.role === Role.ADMIN || user.role === Role.GOVERNMENT_SECRETARY,
    generalQuota: generalQuota?.amountLimit ?? 0,
    allocated: allocated._sum.amountLimit ?? 0,
    items,
  };
}
export async function setGeneralQuota(
  user: SessionUser,
  data: { year: number; month: number; amountLimit: number },
) {
  if (user.role !== Role.ADMIN && user.role !== Role.GOVERNMENT_SECRETARY)
    throw forbidden('Você não possui permissão para definir a quota geral.');
  const allocated = await prisma.fuelQuota.aggregate({
    where: { year: data.year, month: data.month },
    _sum: { amountLimit: true },
  });
  if (data.amountLimit < (allocated._sum.amountLimit ?? 0))
    throw badRequest('A quota geral não pode ser menor que o valor já distribuído às secretarias.');
  const old = await prisma.municipalFuelQuota.findUnique({
    where: { year_month: { year: data.year, month: data.month } },
  });
  const item = await prisma.municipalFuelQuota.upsert({
    where: { year_month: { year: data.year, month: data.month } },
    create: data,
    update: { amountLimit: data.amountLimit },
  });
  await audit({
    userId: user.id,
    action: 'DEFINIU_QUOTA_GERAL',
    entity: 'MunicipalFuelQuota',
    entityId: item.id,
    oldData: old,
    newData: item,
  });
  return item;
}
export async function setQuota(
  user: SessionUser,
  data: { secretariaId: number; year: number; month: number; amountLimit: number },
) {
  if (user.role !== Role.ADMIN && user.role !== Role.GOVERNMENT_SECRETARY)
    throw forbidden('Você não possui permissão para definir quotas.');
  const secretaria = await prisma.secretaria.findFirst({
    where: { id: data.secretariaId, ativo: true },
  });
  if (!secretaria) throw notFound('Secretaria não encontrada.');
  const [generalQuota, allocated] = await Promise.all([
    prisma.municipalFuelQuota.findUnique({
      where: { year_month: { year: data.year, month: data.month } },
    }),
    prisma.fuelQuota.aggregate({
      where: {
        year: data.year,
        month: data.month,
        secretariaId: { not: data.secretariaId },
      },
      _sum: { amountLimit: true },
    }),
  ]);
  if (!generalQuota) throw badRequest('Defina primeiro a quota geral da competência.');
  if ((allocated._sum.amountLimit ?? 0) + data.amountLimit > generalQuota.amountLimit)
    throw badRequest('A distribuição ultrapassa o saldo disponível da quota geral.');
  const old = await prisma.fuelQuota.findUnique({
    where: {
      secretariaId_year_month: {
        secretariaId: data.secretariaId,
        year: data.year,
        month: data.month,
      },
    },
  });
  const item = await prisma.fuelQuota.upsert({
    where: {
      secretariaId_year_month: {
        secretariaId: data.secretariaId,
        year: data.year,
        month: data.month,
      },
    },
    create: data,
    update: { amountLimit: data.amountLimit },
  });
  await audit({
    userId: user.id,
    action: 'DEFINIU_QUOTA',
    entity: 'FuelQuota',
    entityId: item.id,
    oldData: old,
    newData: item,
  });
  return item;
}
