import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, Role, VehicleStatus } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./prisma/database.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.approval.deleteMany();
  await prisma.refueling.deleteMany();
  await prisma.vehicleSession.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.fuelQuota.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  await prisma.secretaria.deleteMany();
  const [saude, educacao, obras] = await Promise.all([
    prisma.secretaria.create({ data: { nome: 'Secretaria Municipal de Saúde', sigla: 'SMS' } }),
    prisma.secretaria.create({ data: { nome: 'Secretaria Municipal de Educação', sigla: 'SME' } }),
    prisma.secretaria.create({ data: { nome: 'Secretaria Municipal de Obras', sigla: 'SMO' } }),
  ]);
  const passwordHash = await bcrypt.hash('admin123', 12);
  const users = [
    ['000001', 'Administrador do Sistema', Role.ADMIN, null],
    ['000002', 'Prefeito Municipal', Role.MAYOR, null],
    ['000003', 'Secretário de Governo', Role.GOVERNMENT_SECRETARY, null],
    ['000101', 'Secretária da Saúde', Role.SECRETARY, saude.id],
    ['000102', 'Secretário da Educação', Role.SECRETARY, educacao.id],
    ['000103', 'Secretário de Obras', Role.SECRETARY, obras.id],
    ['001001', 'João da Silva', Role.DRIVER, obras.id],
    ['001002', 'Maria Santos', Role.DRIVER, saude.id],
    ['001003', 'Carlos Souza', Role.DRIVER, educacao.id],
    ['001004', 'Ana Oliveira', Role.DRIVER, saude.id],
    ['001005', 'Pedro Lima', Role.DRIVER, obras.id],
  ] as const;
  for (const [matricula, nome, role, secretariaId] of users)
    await prisma.user.create({ data: { matricula, nome, role, secretariaId, passwordHash } });
  const vehicles = [
    ['ABC1D23', 'Fiat', 'Strada', obras.id, 82450, 55],
    ['SAU2E34', 'Renault', 'Duster', saude.id, 41200, 50],
    ['EDU3C45', 'Volkswagen', 'Virtus', educacao.id, 28100, 52],
    ['OBR4A56', 'Ford', 'Ranger', obras.id, 96750, 80],
    ['SAU5D67', 'Chevrolet', 'Spin', saude.id, 53800, 53],
    ['EDU6B78', 'Fiat', 'Doblò', educacao.id, 64500, 60],
    ['OBR7E89', 'Volkswagen', 'Saveiro', obras.id, 37900, 55],
    ['SAU8F90', 'Toyota', 'Corolla', saude.id, 22400, 50],
  ] as const;
  for (const [placa, marca, modelo, secretariaId, currentKm, tankCapacity] of vehicles)
    await prisma.vehicle.create({
      data: {
        placa,
        marca,
        modelo,
        secretariaId,
        currentKm,
        tankCapacity,
        fuelType: 'GASOLINA',
        status: VehicleStatus.AVAILABLE,
      },
    });
  const now = new Date();
  for (const secretaria of [saude, educacao, obras])
    await prisma.fuelQuota.create({
      data: {
        secretariaId: secretaria.id,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        amountLimit: 30000,
      },
    });
  console.log('Seed concluído. Todas as contas usam a senha admin123.');
}
main().finally(() => prisma.$disconnect());
