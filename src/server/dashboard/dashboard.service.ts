import { RefuelingStatus, Role, SessionStatus } from '@/generated/prisma/client';
import { SessionUser } from '../auth/session';
import { prisma } from '../database/prisma';

export async function dashboard(user: SessionUser) {
  const scope =
    user.role === Role.SECRETARY
      ? { secretariaId: { in: user.secretariaIds } }
      : user.role === Role.DRIVER
        ? { userId: user.id }
        : {};
  const now = new Date(),
    from = new Date(now.getFullYear(), now.getMonth(), 1),
    historyFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sessionScope =
    user.role === Role.SECRETARY
      ? { secretariaId: { in: user.secretariaIds } }
      : user.role === Role.DRIVER
        ? { userId: user.id }
        : {};
  const [items, history, activeSessions, vehicles, quotas] = await Promise.all([
    prisma.refueling.findMany({
      where: { ...scope, createdAt: { gte: from } },
      include: { secretaria: true, vehicle: true, user: { select: { nome: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.refueling.findMany({
      where: { ...scope, createdAt: { gte: historyFrom }, status: RefuelingStatus.APPROVED },
      select: { createdAt: true, totalAmount: true, liters: true },
    }),
    prisma.vehicleSession.findMany({
      where: { ...sessionScope, status: SessionStatus.ACTIVE },
      include: {
        vehicle: { include: { secretaria: true } },
        user: { select: { id: true, nome: true, matricula: true } },
      },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.vehicle.count({
      where: user.role === Role.SECRETARY ? { secretariaId: { in: user.secretariaIds } } : {},
    }),
    prisma.fuelQuota.findMany({
      where: {
        ...(user.role === Role.SECRETARY ? { secretariaId: { in: user.secretariaIds } } : {}),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      },
      include: { secretaria: true },
    }),
  ]);
  const approved = items.filter(item => item.status === RefuelingStatus.APPROVED);
  const bySecretaria = Object.values(
    approved.reduce<Record<number, { id: number; name: string; amount: number }>>((acc, item) => {
      acc[item.secretariaId] ??= { id: item.secretariaId, name: item.secretaria.nome, amount: 0 };
      acc[item.secretariaId].amount += item.totalAmount;
      return acc;
    }, {}),
  );
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1),
      month = date.getMonth(),
      year = date.getFullYear(),
      monthItems = history.filter(
        item => item.createdAt.getMonth() === month && item.createdAt.getFullYear() === year,
      );
    return {
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''),
      amount: monthItems.reduce((sum, item) => sum + item.totalAmount, 0),
      liters: monthItems.reduce((sum, item) => sum + item.liters, 0),
    };
  });
  const statuses = Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([status, count]) => ({ status, count }));
  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map(day => {
    const dayItems = approved.filter(item => item.createdAt.getDay() === day);
    return {
      label: weekdayNames[day],
      count: dayItems.length,
      liters: dayItems.reduce((sum, item) => sum + item.liters, 0),
    };
  });
  const hourRanges = [
    { label: '00h-05h', from: 0, to: 5 },
    { label: '06h-08h', from: 6, to: 8 },
    { label: '09h-11h', from: 9, to: 11 },
    { label: '12h-14h', from: 12, to: 14 },
    { label: '15h-17h', from: 15, to: 17 },
    { label: '18h-23h', from: 18, to: 23 },
  ];
  const hours = hourRanges.map(range => ({
    label: range.label,
    count: approved.filter(item => {
      const hour = item.createdAt.getHours();
      return hour >= range.from && hour <= range.to;
    }).length,
  }));
  const topVehicles = Object.values(
    approved.reduce<
      Record<number, { name: string; plate: string; liters: number; amount: number; count: number }>
    >((acc, item) => {
      acc[item.vehicleId] ??= {
        name: `${item.vehicle.marca} ${item.vehicle.modelo}`,
        plate: item.vehicle.placa,
        liters: 0,
        amount: 0,
        count: 0,
      };
      acc[item.vehicleId].liters += item.liters;
      acc[item.vehicleId].amount += item.totalAmount;
      acc[item.vehicleId].count += 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.liters - a.liters)
    .slice(0, 6);
  const topSecretarias = Object.values(
    approved.reduce<
      Record<number, { name: string; liters: number; amount: number; count: number }>
    >((acc, item) => {
      acc[item.secretariaId] ??= {
        name: item.secretaria.nome,
        liters: 0,
        amount: 0,
        count: 0,
      };
      acc[item.secretariaId].liters += item.liters;
      acc[item.secretariaId].amount += item.totalAmount;
      acc[item.secretariaId].count += 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.liters - a.liters)
    .slice(0, 6);
  return {
    totals: {
      amount: approved.reduce((sum, item) => sum + item.totalAmount, 0),
      liters: approved.reduce((sum, item) => sum + item.liters, 0),
      quota: quotas.reduce((sum, quota) => sum + quota.amountLimit, 0),
      pending: items.filter(item => item.status.startsWith('WAITING_')).length,
      activeVehicles: activeSessions.length,
      vehicles,
    },
    activeSessions,
    bySecretaria,
    recent: items.slice(0, 8),
    quotas,
    analytics: {
      monthly,
      statuses,
      weekdays,
      hours,
      topVehicles,
      topSecretarias,
      quotaUsage: quotas.map(quota => ({
        name: quota.secretaria.nome,
        limit: quota.amountLimit,
        spent: bySecretaria.find(item => item.id === quota.secretariaId)?.amount ?? 0,
      })),
    },
  };
}
