import { randomInt } from 'node:crypto';
import { ApprovalAction, RefuelingStatus, Role, SessionStatus } from '@/generated/prisma/client';
import { roleLabel, statusLabel, timelineActionLabel } from '@/lib/status';
import { SessionUser } from '../auth/session';
import { prisma } from '../database/prisma';
import { audit } from '../audit/audit.service';
import { generateRefuelingVoucher } from './voucher.service';
import { publicObjectUrl } from '../storage/r2';
import { badRequest, forbidden, notFound } from '../http/errors';
export type CreateRefueling = {
  sessionId?: number;
  driverId?: number;
  vehicleId: number;
  km: number;
  liters: number;
  pricePerLiter: number;
  totalAmount?: number;
  fuelType: string;
  stationId?: number;
  fuelStation?: string;
  pumpPhoto?: string;
  odometerPhoto?: string;
  receiptPhoto: string;
  observation?: string;
  refueledAt?: Date;
};
export type Decision = { action: 'APPROVED' | 'REJECTED' | 'RETURNED'; observation?: string };
export async function createRefueling(user: SessionUser, data: CreateRefueling) {
  const delegated = user.role !== Role.DRIVER;
  const simplifiedEvidence = user.role === Role.ADMIN || user.role === Role.SECRETARY;
  if (delegated && !data.driverId && !simplifiedEvidence)
    throw badRequest('Selecione quem realizou o abastecimento.');
  if (data.refueledAt && user.role !== Role.SECRETARY)
    throw forbidden('Somente secretários podem informar um abastecimento retroativo.');
  if (data.totalAmount && user.role !== Role.SECRETARY)
    throw forbidden('Somente secretários podem informar diretamente o valor total.');
  const now = new Date();
  const refueledAt = data.refueledAt ?? now;
  if (refueledAt.getTime() > now.getTime() + 60_000)
    throw badRequest('A data do abastecimento não pode estar no futuro.');
  const {
    sessionId: _,
    driverId: __,
    vehicleId: ___,
    refueledAt: ____,
    totalAmount: _____,
    ...refuelingData
  } = data;
  if (!data.receiptPhoto) throw badRequest('A foto do comprovante é obrigatória.');
  if (!simplifiedEvidence && (!data.pumpPhoto || !data.odometerPhoto))
    throw badRequest('As fotos do comprovante, da bomba e do hodômetro são obrigatórias.');
  const created = await prisma.$transaction(async tx => {
    const driverId = delegated ? data.driverId : user.id;
    const [driver, vehicle, session] = await Promise.all([
      driverId
        ? tx.user.findFirst({
            where: { id: driverId, role: Role.DRIVER, ativo: true },
          })
        : null,
      tx.vehicle.findUnique({
        where: { id: data.vehicleId },
        include: { secretaria: true },
      }),
      data.sessionId && driverId
        ? tx.vehicleSession.findFirst({
            where: {
              id: data.sessionId,
              userId: driverId,
              vehicleId: data.vehicleId,
              status: SessionStatus.ACTIVE,
            },
          })
        : null,
    ]);
    if (driverId && !driver) throw badRequest('O motorista selecionado não está disponível.');
    if (!vehicle) throw badRequest('O veículo selecionado não foi encontrado.');
    const allowedSecretarias =
      user.role === Role.SECRETARY
        ? user.secretariaIds
        : user.role === Role.DRIVER
          ? user.secretariaId
            ? [user.secretariaId]
            : []
          : null;
    if (
      allowedSecretarias &&
      (!allowedSecretarias.includes(vehicle.secretariaId) ||
        (driver && (!driver.secretariaId || !allowedSecretarias.includes(driver.secretariaId))))
    )
      throw forbidden('Motorista e veículo devem pertencer a uma secretaria permitida.');
    if (driver && driver.secretariaId !== vehicle.secretariaId)
      throw forbidden('Motorista e veículo devem pertencer à mesma secretaria.');
    if (data.sessionId && !session)
      throw badRequest('A utilização informada não corresponde ao motorista e ao veículo.');
    const station = data.stationId
      ? await tx.gasStation.findFirst({ where: { id: data.stationId, active: true } })
      : null;
    if (data.stationId && !station) throw badRequest('O posto selecionado não está disponível.');
    if (!station && !data.fuelStation?.trim())
      throw badRequest('Informe o nome do outro posto utilizado.');
    const fuelType = data.fuelType.toUpperCase();
    const registeredPrice = station
      ? fuelType.includes('ETANOL')
        ? station.ethanolPrice
        : fuelType.includes('DIESEL')
          ? fuelType.includes('S500')
            ? station.dieselS500Price
            : station.dieselS10Price
          : station.gasolinePrice
      : null;
    const stationPrice = data.totalAmount
      ? data.totalAmount / data.liters
      : registeredPrice || data.pricePerLiter;
    if (!stationPrice) throw badRequest('Informe o preço por litro do abastecimento.');
    if (station) {
      const used = await tx.refueling.aggregate({
        where: {
          stationId: station.id,
          status: { not: RefuelingStatus.REJECTED },
        },
        _sum: { liters: true },
      });
      if ((used._sum.liters ?? 0) + data.liters > station.contractLitersLimit)
        throw badRequest('Este abastecimento ultrapassa o saldo de litros do contrato do posto.');
    }
    const [previous, next] = await Promise.all([
      tx.refueling.findFirst({
        where: { vehicleId: vehicle.id, createdAt: { lte: refueledAt } },
        orderBy: { createdAt: 'desc' },
      }),
      tx.refueling.findFirst({
        where: { vehicleId: vehicle.id, createdAt: { gt: refueledAt } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    if (data.km < Math.max(session?.startKm ?? 0, previous?.km ?? 0))
      throw badRequest('A quilometragem é inferior ao registro anterior a essa data.');
    if (next && data.km > next.km)
      throw badRequest('A quilometragem é superior ao registro posterior a essa data.');
    if (!next && data.km < vehicle.currentKm)
      throw badRequest('A quilometragem informada não pode ser inferior à quilometragem atual.');
    const alerts: string[] = [];
    if (!driver)
      alerts.push('Motorista não informado; abastecimento registrado por uma autoridade.');
    if (data.totalAmount)
      alerts.push('Valor total informado manualmente pelo secretário; preço por litro calculado.');
    if (!station) alerts.push('Abastecimento realizado em posto não cadastrado.');
    if (vehicle.tankCapacity && data.liters > vehicle.tankCapacity)
      alerts.push('Litros acima da capacidade do tanque.');
    if (previous && data.km - previous.km < 20)
      alerts.push('Abastecimentos com quilometragem muito próxima.');
    const secretaria = (vehicle.secretaria.sigla || vehicle.secretaria.nome)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase(),
      externalCode = `ABAST-${secretaria}-${randomInt(100000, 1000000)}`;
    const item = await tx.refueling.create({
      data: {
        ...refuelingData,
        externalCode,
        stationId: station?.id ?? null,
        fuelStation: station?.name ?? data.fuelStation!.trim(),
        fuelType,
        pricePerLiter: stationPrice,
        totalAmount: data.totalAmount
          ? Math.round(data.totalAmount * 100) / 100
          : Math.round(data.liters * stationPrice * 100) / 100,
        sessionId: session?.id ?? null,
        userId: driver?.id ?? user.id,
        vehicleId: vehicle.id,
        secretariaId: vehicle.secretariaId,
        hasAlert: !!alerts.length,
        alertMessage: alerts.join(' '),
        createdAt: refueledAt,
      },
    });
    if (data.km > vehicle.currentKm)
      await tx.vehicle.update({ where: { id: vehicle.id }, data: { currentKm: data.km } });
    await audit(
      {
        userId: user.id,
        action: 'REGISTROU_ABASTECIMENTO',
        entity: 'Refueling',
        entityId: item.id,
        newData: delegated ? { ...item, registradoPorId: user.id } : item,
      },
      tx,
    );
    return item;
  });
  const vouchers = await generateRefuelingVoucher(created.id);
  return {
    ...created,
    voucherPdf: vouchers.printUrl,
    voucherReceiptPdf: vouchers.receiptUrl,
    voucherA4Pdf: vouchers.a4Url,
  };
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
    if (user.role === Role.SECRETARY && !user.secretariaIds.includes(item.secretariaId))
      throw forbidden();
    const secretaryStage =
      user.role === Role.SECRETARY && item.status === RefuelingStatus.WAITING_SECRETARY;
    const secretaryApproved = item.approvals.some(
      approval =>
        (approval.role === Role.SECRETARY || approval.role === Role.ADMIN) &&
        approval.action === ApprovalAction.APPROVED,
    );
    const finalStage =
      (user.role === Role.GOVERNMENT_SECRETARY || user.role === Role.MAYOR) &&
      (item.status === RefuelingStatus.WAITING_GOVERNMENT ||
        item.status === RefuelingStatus.WAITING_MAYOR) &&
      secretaryApproved;
    const adminStage =
      user.role === Role.ADMIN &&
      (item.status === RefuelingStatus.WAITING_SECRETARY ||
        item.status === RefuelingStatus.WAITING_GOVERNMENT ||
        item.status === RefuelingStatus.WAITING_MAYOR);
    if (!secretaryStage && !finalStage && !adminStage)
      throw badRequest(
        'A tramitação deve seguir a ordem: motorista, secretário responsável e autoridade final.',
      );
    const status =
      data.action === 'REJECTED'
        ? RefuelingStatus.REJECTED
        : data.action === 'RETURNED'
          ? RefuelingStatus.RETURNED
          : item.status === RefuelingStatus.WAITING_SECRETARY
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
  const voucherPdf = publicObjectUrl(item.voucherPdf);
  const voucherA4Pdf = publicObjectUrl(item.voucherA4Pdf);
  return {
    ...item,
    voucherPdf,
    voucherA4Pdf,
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
        attachment:
          log.action === 'GEROU_CUPOM_ABASTECIMENTO'
            ? process.env.REFUELING_VOUCHER_PRINT_FORMAT?.trim().toUpperCase() === 'A4'
              ? voucherA4Pdf
              : voucherPdf
            : null,
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
