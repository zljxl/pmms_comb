import { Role } from '@/generated/prisma/client';
import { SessionUser } from '../auth/session';
import { prisma } from '../database/prisma';
import { audit } from '../audit/audit.service';
import { badRequest, forbidden, notFound } from '../http/errors';

export type CreateStation = {
  name: string;
  legalName: string;
  cnpj: string;
  phone?: string;
  contractNumber?: string;
  address: string;
  latitude: number;
  longitude: number;
  gasolinePrice?: number;
  ethanolPrice?: number;
  dieselS10Price?: number;
  dieselS500Price?: number;
  allowanceYear: number;
  allowanceMonth: number;
  litersLimit: number;
};
export type UpdateStation = Omit<
  CreateStation,
  'allowanceYear' | 'allowanceMonth' | 'litersLimit'
> & { active: boolean };

const managers = new Set<Role>([Role.ADMIN, Role.MAYOR, Role.GOVERNMENT_SECRETARY]);

export function listStations(user: SessionUser) {
  const now = new Date();
  return prisma.gasStation.findMany({
    where: user.role === Role.DRIVER ? { active: true } : {},
    include: { allowances: { where: { year: now.getFullYear(), month: now.getMonth() + 1 } } },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
}

export async function createStation(user: SessionUser, data: CreateStation) {
  if (!managers.has(user.role)) throw forbidden('Você não possui permissão para cadastrar postos.');
  const cnpj = data.cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) throw badRequest('Informe um CNPJ válido com 14 dígitos.');
  if (await prisma.gasStation.findFirst({ where: { cnpj } }))
    throw badRequest('Já existe um fornecedor cadastrado com este CNPJ.');
  const station = await prisma.$transaction(tx =>
    tx.gasStation.create({
      data: {
        name: data.name.trim(),
        legalName: data.legalName.trim(),
        cnpj,
        phone: data.phone?.trim() || null,
        contractNumber: data.contractNumber?.trim() || null,
        address: data.address.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        gasolinePrice: data.gasolinePrice || null,
        ethanolPrice: data.ethanolPrice || null,
        dieselS10Price: data.dieselS10Price || null,
        dieselS500Price: data.dieselS500Price || null,
        createdById: user.id,
        allowances: {
          create: {
            year: data.allowanceYear,
            month: data.allowanceMonth,
            litersLimit: data.litersLimit,
          },
        },
      },
      include: { allowances: true },
    }),
  );
  await audit({
    userId: user.id,
    action: 'CADASTROU_POSTO',
    entity: 'GasStation',
    entityId: station.id,
    newData: station,
  });
  return station;
}

export async function getStationDetails(user: SessionUser, id: number) {
  if (user.role === Role.DRIVER) throw forbidden();
  const station = await prisma.gasStation.findUnique({
    where: { id },
    include: {
      allowances: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 24 },
      refuelings: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          vehicle: { select: { placa: true, marca: true, modelo: true } },
          user: { select: { nome: true, matricula: true } },
          secretaria: { select: { nome: true, sigla: true } },
        },
      },
    },
  });
  if (!station) throw notFound('Posto não encontrado.');
  const usage = new Map<string, { year: number; month: number; liters: number; amount: number }>();
  for (const item of station.refuelings) {
    const date = item.createdAt;
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const current = usage.get(key) ?? {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      liters: 0,
      amount: 0,
    };
    current.liters += item.liters;
    current.amount += item.totalAmount;
    usage.set(key, current);
  }
  return {
    ...station,
    canManage: managers.has(user.role),
    usageByMonth: [...usage.values()].sort((a, b) => b.year - a.year || b.month - a.month),
  };
}

export async function updateStation(user: SessionUser, id: number, data: UpdateStation) {
  if (!managers.has(user.role)) throw forbidden('Você não possui permissão para editar postos.');
  const old = await prisma.gasStation.findUnique({ where: { id } });
  if (!old) throw notFound('Posto não encontrado.');
  const cnpj = data.cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) throw badRequest('Informe um CNPJ válido com 14 dígitos.');
  if (await prisma.gasStation.findFirst({ where: { cnpj, id: { not: id } } }))
    throw badRequest('Já existe outro fornecedor cadastrado com este CNPJ.');
  const station = await prisma.gasStation.update({
    where: { id },
    data: {
      name: data.name.trim(),
      legalName: data.legalName.trim(),
      cnpj,
      phone: data.phone?.trim() || null,
      contractNumber: data.contractNumber?.trim() || null,
      address: data.address.trim(),
      latitude: data.latitude,
      longitude: data.longitude,
      gasolinePrice: data.gasolinePrice || null,
      ethanolPrice: data.ethanolPrice || null,
      dieselS10Price: data.dieselS10Price || null,
      dieselS500Price: data.dieselS500Price || null,
      active: data.active,
    },
  });
  await audit({
    userId: user.id,
    action: 'EDITOU_POSTO',
    entity: 'GasStation',
    entityId: station.id,
    oldData: old,
    newData: station,
  });
  return station;
}

export async function setStationAllowance(
  user: SessionUser,
  stationId: number,
  data: { year: number; month: number; litersLimit: number },
) {
  if (!managers.has(user.role)) throw forbidden();
  if (!(await prisma.gasStation.findUnique({ where: { id: stationId } })))
    throw notFound('Posto não encontrado.');
  const allowance = await prisma.stationFuelAllowance.upsert({
    where: { stationId_year_month: { stationId, year: data.year, month: data.month } },
    create: { stationId, ...data },
    update: { litersLimit: data.litersLimit },
  });
  await audit({
    userId: user.id,
    action: 'DEFINIU_LIMITE_POSTO',
    entity: 'StationFuelAllowance',
    entityId: allowance.id,
    newData: allowance,
  });
  return allowance;
}
