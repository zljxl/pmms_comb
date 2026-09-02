import { RefuelingStatus, Role } from '@/generated/prisma/client';
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
  contractLitersLimit: number;
};
export type UpdateStation = CreateStation & { active: boolean };

const managers = new Set<Role>([Role.ADMIN, Role.MAYOR, Role.GOVERNMENT_SECRETARY]);

export function listStations(user: SessionUser) {
  return prisma.gasStation.findMany({
    where: user.role === Role.DRIVER ? { active: true } : {},
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
}

export async function createStation(user: SessionUser, data: CreateStation) {
  if (!managers.has(user.role)) throw forbidden('Você não possui permissão para cadastrar postos.');
  const cnpj = data.cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) throw badRequest('Informe um CNPJ válido com 14 dígitos.');
  if (await prisma.gasStation.findFirst({ where: { cnpj } }))
    throw badRequest('Já existe um fornecedor cadastrado com este CNPJ.');
  const station = await prisma.gasStation.create({
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
      contractLitersLimit: data.contractLitersLimit,
      createdById: user.id,
    },
  });
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
  const [station, usage] = await Promise.all([
    prisma.gasStation.findUnique({
      where: { id },
      include: {
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
    }),
    prisma.refueling.aggregate({
      where: { stationId: id, status: { not: RefuelingStatus.REJECTED } },
      _sum: { liters: true },
    }),
  ]);
  if (!station) throw notFound('Posto não encontrado.');
  const contractLitersUsed = usage._sum.liters ?? 0;
  return {
    ...station,
    canManage: managers.has(user.role),
    contractLitersUsed,
    contractLitersRemaining: Math.max(0, station.contractLitersLimit - contractLitersUsed),
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
  const usage = await prisma.refueling.aggregate({
    where: { stationId: id, status: { not: RefuelingStatus.REJECTED } },
    _sum: { liters: true },
  });
  if ((usage._sum.liters ?? 0) > data.contractLitersLimit)
    throw badRequest('A quota do contrato não pode ser menor que o total já consumido pelo posto.');
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
      contractLitersLimit: data.contractLitersLimit,
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
