import { randomInt } from 'node:crypto';
import { RefuelingStatus, Role } from '@/generated/prisma/client';
import { SessionUser } from '../auth/session';
import { prisma } from '../database/prisma';
import { audit } from '../audit/audit.service';
import { badRequest, forbidden, notFound } from '../http/errors';

export type CreateAuthorization = {
  number?: string;
  secretariaId: number;
  stationId: number;
  fuelType: string;
  year: number;
  month: number;
  amountLimit: number;
  litersLimit?: number;
  simple?: boolean;
};

const managers = new Set<Role>([Role.ADMIN, Role.GOVERNMENT_SECRETARY]);

function stationPrice(station: {
  gasolinePrice: number | null;
  ethanolPrice: number | null;
  dieselS10Price: number | null;
  dieselS500Price: number | null;
}, fuelType: string) {
  if (fuelType === 'ETANOL') return station.ethanolPrice;
  if (fuelType === 'DIESEL_S10') return station.dieselS10Price;
  if (fuelType === 'DIESEL_S500') return station.dieselS500Price;
  return station.gasolinePrice;
}

export async function listAuthorizations(user: SessionUser, year?: number, month?: number) {
  const now = new Date();
  const competence = { year: year ?? now.getFullYear(), month: month ?? now.getMonth() + 1 };
  const [items, contracts] = await Promise.all([prisma.supplyAuthorization.findMany({
    where: {
      ...competence,
      ...(user.role === Role.SECRETARY ? { secretariaId: { in: user.secretariaIds } } : {}),
      ...(user.role === Role.DRIVER ? { secretariaId: user.secretariaId ?? -1, active: true } : {}),
    },
    include: { secretaria: true, station: true },
    orderBy: [{ active: 'desc' }, { number: 'asc' }],
  }), prisma.gasStation.findMany({
    where: {
      active: true,
      contractStartDate: { lte: now },
      contractEndDate: { gte: now },
      contractAmountLimit: { gt: 0 },
    },
    select: {
      id: true, name: true, contractNumber: true, contractStartDate: true,
      contractEndDate: true, contractAmountLimit: true,
    },
    orderBy: { name: 'asc' },
  })]);
  const usage = await prisma.refueling.groupBy({
    by: ['authorizationId'],
    where: {
      authorizationId: { in: items.map(item => item.id) },
      status: { not: RefuelingStatus.REJECTED },
    },
    _sum: { totalAmount: true, liters: true },
  });
  const used = new Map(usage.map(item => [item.authorizationId, item._sum]));
  return {
    ...competence,
    canManage: managers.has(user.role),
    generalQuota: contracts.reduce((total, contract) => total + contract.contractAmountLimit, 0),
    contracts: contracts.map(contract => ({
      ...contract,
      contractStartDate: contract.contractStartDate!.toISOString(),
      contractEndDate: contract.contractEndDate!.toISOString(),
    })),
    items: items.map(item => {
      const totals = used.get(item.id);
      const amountUsed = totals?.totalAmount ?? 0;
      const litersUsed = totals?.liters ?? 0;
      return {
        ...item,
        amountUsed,
        litersUsed,
        amountRemaining: Math.max(0, item.amountLimit - amountUsed),
        litersRemaining: Math.max(0, item.litersLimit - litersUsed),
      };
    }),
  };
}

export async function createAuthorization(user: SessionUser, data: CreateAuthorization) {
  if (!managers.has(user.role))
    throw forbidden('Somente administradores e secretários de governo podem cadastrar AFs.');
  const [secretaria, station] = await Promise.all([
    prisma.secretaria.findFirst({ where: { id: data.secretariaId, ativo: true } }),
    prisma.gasStation.findFirst({ where: { id: data.stationId, active: true } }),
  ]);
  if (!secretaria) throw notFound('Secretaria não encontrada.');
  if (!station) throw notFound('Posto não encontrado.');
  const now = new Date();
  if (!station.contractStartDate || !station.contractEndDate ||
      station.contractStartDate > now || station.contractEndDate < now)
    throw badRequest('O contrato deste posto não está dentro da vigência.');
  const fuelType = data.fuelType.trim().toUpperCase();
  const price = stationPrice(station, fuelType);
  if (!price) throw badRequest('O posto não possui preço cadastrado para este combustível.');
  const litersLimit = data.simple ? data.amountLimit / price : data.litersLimit;
  if (!litersLimit || litersLimit <= 0) throw badRequest('Informe um limite válido em litros.');
  if (!data.simple && !data.number?.trim()) throw badRequest('Informe o número da AF.');
  const number =
    data.number?.trim().toUpperCase() ||
    `AF-SIMP-${data.year}${String(data.month).padStart(2, '0')}-${randomInt(1000, 10000)}`;
  if (await prisma.supplyAuthorization.findUnique({ where: { number } }))
    throw badRequest('Já existe uma AF com este número.');
  const [contracts, allocated] = await Promise.all([
    prisma.gasStation.aggregate({
      where: {
        active: true,
        contractStartDate: { lte: now },
        contractEndDate: { gte: now },
        contractAmountLimit: { gt: 0 },
      },
      _sum: { contractAmountLimit: true },
    }),
    prisma.supplyAuthorization.aggregate({
      where: { active: true },
      _sum: { amountLimit: true },
    }),
  ]);
  const generalQuota = contracts._sum.contractAmountLimit ?? 0;
  if ((allocated._sum.amountLimit ?? 0) + data.amountLimit > generalQuota)
    throw badRequest('O valor das AFs ultrapassa a quota geral dos contratos vigentes.');
  const item = await prisma.supplyAuthorization.create({
    data: {
      number,
      secretariaId: data.secretariaId,
      stationId: data.stationId,
      fuelType,
      year: data.year,
      month: data.month,
      amountLimit: data.amountLimit,
      litersLimit,
    },
    include: { secretaria: true, station: true },
  });
  await audit({
    userId: user.id,
    action: data.simple ? 'CADASTROU_AF_SIMPLES' : 'CADASTROU_AF',
    entity: 'SupplyAuthorization',
    entityId: item.id,
    newData: item,
  });
  return item;
}

export async function deleteAuthorization(user: SessionUser, id: number) {
  if (!managers.has(user.role))
    throw forbidden('Somente administradores e secretários de governo podem excluir AFs.');
  const item = await prisma.supplyAuthorization.findUnique({
    where: { id },
    include: { _count: { select: { refuelings: true } } },
  });
  if (!item) throw notFound('AF não encontrada.');
  if (item._count.refuelings > 0)
    throw badRequest('Não é possível excluir uma AF que já possui abastecimentos vinculados.');
  await prisma.supplyAuthorization.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: 'EXCLUIU_AF',
    entity: 'SupplyAuthorization',
    entityId: id,
    oldData: item,
  });
  return { success: true };
}
