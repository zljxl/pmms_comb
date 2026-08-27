import { randomInt } from 'node:crypto';
import { ApprovalAction, RefuelingStatus, Role, SessionStatus } from '@/generated/prisma/client';
import { roleLabel, statusLabel, timelineActionLabel } from '@/lib/status';
import { SessionUser } from '../auth/session';
import { prisma } from '../database/prisma';
import { audit } from '../audit/audit.service';
import { generateRefuelingVoucher } from './voucher.service';
import { badRequest, forbidden, notFound } from '../http/errors';
export type CreateRefueling = {
  km: number;
  liters: number;
  pricePerLiter: number;
  fuelType: string;
  stationId?: number;
  fuelStation?: string;
  pumpPhoto: string;
  odometerPhoto: string;
  receiptPhoto: string;
  observation?: string;
};
export type Decision = { action: 'APPROVED' | 'REJECTED' | 'RETURNED'; observation?: string };
export async function createRefueling(user: SessionUser, data: CreateRefueling) {
  if (user.role !== Role.DRIVER) throw forbidden();
  if (!data.pumpPhoto || !data.odometerPhoto || !data.receiptPhoto)
    throw badRequest('As fotos do comprovante, da bomba e do hodômetro são obrigatórias.');
  const created = await prisma.$transaction(async tx => {
    const session = await tx.vehicleSession.findFirst({
      where: { userId: user.id, status: SessionStatus.ACTIVE },
      include: { vehicle: true, secretaria: true },
    });
    if (!session) throw badRequest('Você precisa estar com um veículo em utilização.');
    const station = data.stationId
      ? await tx.gasStation.findFirst({ where: { id: data.stationId, active: true } })
      : null;
    if (data.stationId && !station) throw badRequest('O posto selecionado não está disponível.');
    if (!station && !data.fuelStation?.trim())
      throw badRequest('Informe o nome do outro posto utilizado.');
    const fuelType = (session.vehicle.fuelType || data.fuelType).toUpperCase();
    const stationPrice = station
      ? fuelType.includes('ETANOL')
        ? station.ethanolPrice
        : fuelType.includes('DIESEL')
          ? station.dieselPrice
          : station.gasolinePrice
      : data.pricePerLiter;
    if (!stationPrice) throw badRequest(`O posto não possui preço cadastrado para ${fuelType}.`);
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    if (station) {
      const allowance = await tx.stationFuelAllowance.findUnique({
        where: {
          stationId_year_month: {
            stationId: station.id,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          },
        },
      });
      if (!allowance)
        throw badRequest('O posto não possui litros liberados para a competência atual.');
      const used = await tx.refueling.aggregate({
        where: {
          stationId: station.id,
          createdAt: { gte: periodStart, lt: periodEnd },
          status: { not: RefuelingStatus.REJECTED },
        },
        _sum: { liters: true },
      });
      if ((used._sum.liters ?? 0) + data.liters > allowance.litersLimit)
        throw badRequest(
          'Este abastecimento ultrapassa o limite de litros liberados para o posto.',
        );
    }
    const previous = await tx.refueling.findFirst({
      where: { vehicleId: session.vehicleId },
      orderBy: { km: 'desc' },
    });
    if (data.km < Math.max(session.startKm, session.vehicle.currentKm, previous?.km ?? 0))
      throw badRequest('A quilometragem informada não pode ser inferior ao último registro.');
    const alerts: string[] = [];
    if (!station) alerts.push('Abastecimento realizado em posto não cadastrado.');
    if (session.vehicle.tankCapacity && data.liters > session.vehicle.tankCapacity)
      alerts.push('Litros acima da capacidade do tanque.');
    if (previous && data.km - previous.km < 20)
      alerts.push('Abastecimentos com quilometragem muito próxima.');
    const secretaria = (session.secretaria.sigla || session.secretaria.nome)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase(),
      externalCode = `ABAST-${secretaria}-${randomInt(100000, 1000000)}`;
    const item = await tx.refueling.create({
      data: {
        ...data,
        externalCode,
        stationId: station?.id ?? null,
        fuelStation: station?.name ?? data.fuelStation!.trim(),
        fuelType,
        pricePerLiter: stationPrice,
        totalAmount: Math.round(data.liters * stationPrice * 100) / 100,
        sessionId: session.id,
        userId: user.id,
        vehicleId: session.vehicleId,
        secretariaId: session.secretariaId,
        hasAlert: !!alerts.length,
        alertMessage: alerts.join(' '),
      },
    });
    await tx.vehicle.update({ where: { id: session.vehicleId }, data: { currentKm: data.km } });
    await audit(
      {
        userId: user.id,
        action: 'REGISTROU_ABASTECIMENTO',
        entity: 'Refueling',
        entityId: item.id,
        newData: item,
      },
      tx,
    );
    return item;
  });
  const voucherPdf = await generateRefuelingVoucher(created.id);
  return { ...created, voucherPdf };
}
export async function listRefuelings(user: SessionUser) {
  const where =
    user.role === Role.DRIVER
      ? { userId: user.id }
      : user.role === Role.SECRETARY
        ? { secretariaId: { in: user.secretariaIds } }
        : {};
  return prisma.refueling.findMany({
    where,
    include: {
      vehicle: true,
      user: { select: { nome: true, matricula: true } },
      secretaria: true,
      approvals: { include: { user: { select: { nome: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
export async function decideRefueling(user: SessionUser, id: number, data: Decision) {
  if (data.action !== 'APPROVED' && !data.observation?.trim())
    throw badRequest('Justificativa é obrigatória.');
  return prisma.$transaction(async tx => {
    const item = await tx.refueling.findUnique({
      where: { id },
      include: { approvals: true },
    });
    if (!item) throw notFound();
    if (user.role === Role.SECRETARY && !user.secretariaIds.includes(item.secretariaId)) throw forbidden();
    const secretaryStage =
      user.role === Role.SECRETARY && item.status === RefuelingStatus.WAITING_SECRETARY;
    const secretaryApproved = item.approvals.some(
      approval => approval.role === Role.SECRETARY && approval.action === ApprovalAction.APPROVED,
    );
    const finalStage =
      (user.role === Role.GOVERNMENT_SECRETARY || user.role === Role.MAYOR) &&
      (item.status === RefuelingStatus.WAITING_GOVERNMENT ||
        item.status === RefuelingStatus.WAITING_MAYOR) &&
      secretaryApproved;
    if (!secretaryStage && !finalStage)
      throw badRequest(
        'A tramitação deve seguir a ordem: motorista, secretário responsável e autoridade final.',
      );
    const status =
      data.action === 'REJECTED'
        ? RefuelingStatus.REJECTED
        : data.action === 'RETURNED'
          ? RefuelingStatus.RETURNED
          : user.role === Role.SECRETARY
            ? RefuelingStatus.WAITING_GOVERNMENT
            : RefuelingStatus.APPROVED;
    await tx.approval.create({
      data: {
        refuelingId: id,
        userId: user.id,
        role: user.role,
        action: data.action as ApprovalAction,
        observation: data.observation,
      },
    });
    const updated = await tx.refueling.update({ where: { id }, data: { status } });
    await audit(
      {
        userId: user.id,
        action: `${data.action}_ABASTECIMENTO`,
        entity: 'Refueling',
        entityId: id,
        oldData: item,
        newData: updated,
      },
      tx,
    );
    return updated;
  });
}
export async function getRefuelingDetails(user: SessionUser, id: number) {
  const item = await prisma.refueling.findUnique({
    where: { id },
    include: {
      vehicle: true,
      user: { select: { id: true, nome: true, matricula: true } },
      secretaria: true,
      approvals: {
        include: { user: { select: { nome: true, matricula: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!item) throw notFound('Abastecimento não encontrado.');
  if (
    (user.role === Role.DRIVER && item.userId !== user.id) ||
    (user.role === Role.SECRETARY && !user.secretariaIds.includes(item.secretariaId))
  )
    throw forbidden();
  const logs = await prisma.auditLog.findMany({
    where: { entity: 'Refueling', entityId: String(id) },
    include: { user: { select: { nome: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return {
    ...item,
    timeline: [
      {
        type: 'CREATED',
        label: 'Abastecimento registrado',
        date: item.createdAt,
        user: item.user.nome,
        observation: item.observation,
        attachment: null,
      },
      ...logs.map(log => ({
        type: log.action,
        label: timelineActionLabel(log.action),
        date: log.createdAt,
        user: log.user?.nome ?? 'Sistema',
        observation: log.description,
        attachment: log.action === 'GEROU_CUPOM_ABASTECIMENTO' ? item.voucherPdf : null,
      })),
      ...item.approvals.map(approval => ({
        type: approval.action,
        label: `${statusLabel(approval.action)} POR ${roleLabel(approval.role)}`,
        date: approval.createdAt,
        user: approval.user.nome,
        observation: approval.observation,
        attachment: null,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime()),
  };
}
export async function rectifyRefueling(
  user: SessionUser,
  id: number,
  data: Partial<CreateRefueling>,
) {
  if (user.role !== Role.DRIVER) throw forbidden();
  return prisma.$transaction(async tx => {
    const item = await tx.refueling.findUnique({ where: { id } });
    if (!item || item.userId !== user.id) throw notFound('Abastecimento não encontrado.');
    if (item.status !== RefuelingStatus.RETURNED)
      throw badRequest('Somente abastecimentos devolvidos podem ser retificados.');
    const updated = await tx.refueling.update({
      where: { id },
      data: {
        km: data.km ?? item.km,
        liters: data.liters ?? item.liters,
        pricePerLiter: data.pricePerLiter ?? item.pricePerLiter,
        totalAmount:
          Math.round(
            (data.liters ?? item.liters) * (data.pricePerLiter ?? item.pricePerLiter) * 100,
          ) / 100,
        fuelStation: data.fuelStation ?? item.fuelStation,
        pumpPhoto: data.pumpPhoto ?? item.pumpPhoto,
        odometerPhoto: data.odometerPhoto ?? item.odometerPhoto,
        receiptPhoto: data.receiptPhoto ?? item.receiptPhoto,
        observation: data.observation ?? item.observation,
        status: RefuelingStatus.WAITING_SECRETARY,
      },
    });
    await audit(
      {
        userId: user.id,
        action: 'RETIFICOU_ABASTECIMENTO',
        entity: 'Refueling',
        entityId: id,
        oldData: item,
        newData: updated,
      },
      tx,
    );
    return updated;
  });
}
