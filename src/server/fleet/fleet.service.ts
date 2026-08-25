import { Role, SessionStatus, VehicleStatus } from '@/generated/prisma/client';
import { SessionUser } from '../auth/session';
import { prisma } from '../database/prisma';
import { audit } from '../audit/audit.service';
import { badRequest, forbidden, notFound } from '../http/errors';
export type StartSession = {
  vehicleId: number;
  startKm: number;
  startPhoto: string;
  startLatitude: number;
  startLongitude: number;
  startNote?: string;
};
export type FinishSession = {
  endKm: number;
  endPhoto: string;
  endLatitude: number;
  endLongitude: number;
  endNote?: string;
};
export type CreateVehicle = {
  placa: string;
  patrimonio?: string;
  marca: string;
  modelo: string;
  ano?: number;
  fuelType?: string;
  tankCapacity?: number;
  currentKm: number;
  secretariaId?: number;
};
const include = {
  vehicle: { include: { secretaria: true } },
  user: { select: { id: true, nome: true, matricula: true } },
  refuelings: true,
} as const;
export function listVehicles(user: SessionUser) {
  if (user.role === Role.DRIVER)
    throw forbidden('Motoristas não possuem acesso ao catálogo da frota.');
  return prisma.vehicle.findMany({
    where: user.role === Role.SECRETARY ? { secretariaId: user.secretariaId! } : {},
    include: { secretaria: true },
    orderBy: { placa: 'asc' },
  });
}
export function listAvailableVehicles(user: SessionUser) {
  if (user.role !== Role.DRIVER) throw forbidden();
  return prisma.vehicle.findMany({
    where: {
      status: VehicleStatus.AVAILABLE,
      sessions: { none: { status: SessionStatus.ACTIVE } },
    },
    select: {
      id: true,
      placa: true,
      marca: true,
      modelo: true,
      currentKm: true,
      status: true,
      secretaria: { select: { id: true, nome: true } },
    },
    orderBy: [{ secretaria: { nome: 'asc' } }, { placa: 'asc' }],
  });
}
export async function createVehicle(user: SessionUser, data: CreateVehicle) {
  if (
    user.role !== Role.ADMIN &&
    user.role !== Role.SECRETARY &&
    user.role !== Role.GOVERNMENT_SECRETARY
  )
    throw forbidden('Você não possui permissão para cadastrar veículos.');
  const secretariaId = user.role === Role.SECRETARY ? user.secretariaId : data.secretariaId;
  if (!secretariaId) throw badRequest('Informe a secretaria do veículo.');
  if (!(await prisma.secretaria.findFirst({ where: { id: secretariaId, ativo: true } })))
    throw notFound('Secretaria não encontrada.');
  const placa = data.placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (await prisma.vehicle.findUnique({ where: { placa } }))
    throw badRequest('Já existe um veículo com esta placa.');
  const vehicle = await prisma.vehicle.create({
    data: {
      ...data,
      placa,
      secretariaId,
      patrimonio: data.patrimonio?.trim() || null,
      fuelType: data.fuelType?.trim().toUpperCase() || null,
    },
    include: { secretaria: true },
  });
  await audit({
    userId: user.id,
    action: 'CADASTROU_VEICULO',
    entity: 'Vehicle',
    entityId: vehicle.id,
    newData: vehicle,
  });
  return vehicle;
}
export async function getVehicleDetails(user: SessionUser, id: number) {
  if (user.role === Role.DRIVER)
    throw forbidden('Motoristas não possuem acesso ao histórico dos veículos.');
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      secretaria: true,
      sessions: {
        take: 20,
        orderBy: { startedAt: 'desc' },
        include: { user: { select: { id: true, nome: true, matricula: true } } },
      },
      refuelings: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, nome: true, matricula: true } } },
      },
    },
  });
  if (!vehicle) throw notFound('Veículo não encontrado.');
  if (user.role === Role.SECRETARY && vehicle.secretariaId !== user.secretariaId) throw forbidden();
  return vehicle;
}
export function currentSession(user: SessionUser) {
  return prisma.vehicleSession.findFirst({
    where: { userId: user.id, status: SessionStatus.ACTIVE },
    include,
  });
}
export async function startSession(user: SessionUser, data: StartSession) {
  if (user.role !== Role.DRIVER) throw forbidden('Somente motoristas podem assumir veículos.');
  if (!data.startPhoto) throw badRequest('A foto do hodômetro é obrigatória.');
  if (!Number.isFinite(data.startLatitude) || !Number.isFinite(data.startLongitude))
    throw badRequest('A localização do dispositivo é obrigatória.');
  return prisma.$transaction(async tx => {
    if (
      await tx.vehicleSession.findFirst({
        where: { userId: user.id, status: SessionStatus.ACTIVE },
      })
    )
      throw badRequest('Você já possui um veículo em utilização.');
    const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) throw notFound('Veículo não encontrado.');
    if (
      vehicle.status !== VehicleStatus.AVAILABLE ||
      (await tx.vehicleSession.findFirst({
        where: { vehicleId: vehicle.id, status: SessionStatus.ACTIVE },
      }))
    )
      throw badRequest('Este veículo já está em utilização.');
    const crossSecretaria = vehicle.secretariaId !== user.secretariaId;
    if (data.startKm < vehicle.currentKm)
      throw badRequest('A quilometragem informada não pode ser inferior ao último registro.');
    const session = await tx.vehicleSession.create({
      data: { ...data, userId: user.id, secretariaId: vehicle.secretariaId },
    });
    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { status: VehicleStatus.IN_USE, currentKm: data.startKm },
    });
    await audit(
      {
        userId: user.id,
        action: 'ASSUMIU_VEICULO',
        entity: 'VehicleSession',
        entityId: session.id,
        description: crossSecretaria
          ? 'Motorista utilizou veículo pertencente a outra secretaria.'
          : undefined,
        newData: session,
      },
      tx,
    );
    const created = await tx.vehicleSession.findUnique({ where: { id: session.id }, include });
    return {
      ...created,
      warning: crossSecretaria
        ? 'Este veículo pertence a outra secretaria. A utilização foi permitida e registrada.'
        : null,
    };
  });
}
export async function finishSession(user: SessionUser, id: number, data: FinishSession) {
  if (!data.endPhoto) throw badRequest('A foto do hodômetro final é obrigatória.');
  if (!Number.isFinite(data.endLatitude) || !Number.isFinite(data.endLongitude))
    throw badRequest('A localização final do dispositivo é obrigatória.');
  return prisma.$transaction(async tx => {
    const session = await tx.vehicleSession.findUnique({ where: { id } });
    if (!session || session.status !== SessionStatus.ACTIVE)
      throw notFound('Sessão ativa não encontrada.');
    if (session.userId !== user.id && user.role !== Role.ADMIN) throw forbidden();
    const last = await tx.refueling.findFirst({
      where: { sessionId: id },
      orderBy: { km: 'desc' },
    });
    if (data.endKm < Math.max(session.startKm, last?.km ?? 0))
      throw badRequest('O KM final não pode ser inferior ao último registro.');
    const ended = await tx.vehicleSession.update({
      where: { id },
      data: { ...data, status: SessionStatus.FINISHED, endedAt: new Date() },
    });
    await tx.vehicle.update({
      where: { id: session.vehicleId },
      data: { status: VehicleStatus.AVAILABLE, currentKm: data.endKm },
    });
    await audit(
      {
        userId: user.id,
        action: 'ENCERROU_VEICULO',
        entity: 'VehicleSession',
        entityId: id,
        oldData: session,
        newData: ended,
      },
      tx,
    );
    return ended;
  });
}
