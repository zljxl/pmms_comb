import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import { hashPassword } from '../src/server/auth/password';
import { fleet2026, fleetSecretarias } from './fleet-2026';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL não foi configurada.');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type CsvDriver = {
  matricula: string;
  nome: string;
  cnh: string;
  unidade: string;
  ativo: boolean;
};

const secretariaQuotas = [
  {
    nome: 'Secretaria Municipal de Limpeza Pública',
    sigla: 'SEMLIP',
    matricula: 'SEMLIP',
    responsavelNome: 'José Olimpio de Souza Pereira',
    dieselS10Limit: 50_000,
    gasolineLimit: 10_000,
  },
  {
    nome: 'Secretaria Municipal de Cultura',
    sigla: 'SEMCULT',
    matricula: 'SEMCULT',
    responsavelNome: 'Andréa Lima Rodrigues de Souza',
    dieselS10Limit: 0,
    gasolineLimit: 1_000,
  },
  {
    nome: 'Secretaria Municipal de Meio Ambiente e Recursos Hídricos',
    sigla: 'SEMMA/RH',
    matricula: 'SEMMARH',
    responsavelNome: 'Whitson José da Costa Junior',
    dieselS10Limit: 0,
    gasolineLimit: 2_000,
  },
  {
    nome: 'Secretaria Municipal de Obras e Serviços Urbanos',
    sigla: 'SEMOSU',
    matricula: 'SEMOSU',
    responsavelNome: 'Ricardo Ramos Alves',
    dieselS10Limit: 2_500,
    gasolineLimit: 2_500,
  },
  {
    nome: 'Secretaria Municipal de Administração',
    sigla: 'SEMAD',
    matricula: 'SEMAD',
    responsavelNome: 'Claudinei Trugilio da Silva',
    dieselS10Limit: 0,
    gasolineLimit: 3_000,
  },
  {
    nome: 'Secretaria Municipal de Assistência Social',
    sigla: 'SEMAS',
    matricula: 'SEMAS',
    responsavelNome: 'Lilian de Fátima Pires Rosa',
    dieselS10Limit: 0,
    gasolineLimit: 2_000,
  },
  {
    nome: 'Reviver',
    sigla: 'REVIVER',
    matricula: 'REVIVER',
    responsavelNome: 'Associação de Apoio Terapêutico Reviver',
    dieselS10Limit: 0,
    gasolineLimit: 6_000,
  },
  {
    nome: 'Secretaria Municipal de Educação',
    sigla: 'SEME',
    matricula: 'SEME',
    responsavelNome: 'Gracielli Pereira Defante Pacheco',
    dieselS10Limit: 50_000,
    gasolineLimit: 5_000,
  },
  {
    nome: 'Secretaria Municipal de Agricultura',
    sigla: 'SEMAG',
    matricula: 'SEMAG',
    responsavelNome: 'Luciano Gonçalves Belloti',
    dieselS10Limit: 60_000,
    gasolineLimit: 20_000,
  },
] as const;

const knownBrands = [
  'Mercedes-Benz',
  'Volkswagen',
  'New Holland',
  'Caterpillar',
  'Chevrolet',
  'Marcopolo',
  'Renault',
  'Toyota',
  'XCMG',
  'Iveco',
  'Foton',
  'Volvo',
  'Ford',
  'Fiat',
  'Case',
  'JCB',
  'Ensign',
];

function vehicleBrand(description: string) {
  return knownBrands.find(brand => description.includes(brand)) ?? 'Não informada';
}

function parseDrivers(csv: string): CsvDriver[] {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const header = lines.shift();

  if (header !== 'Registro;Nome;CNH;Unidade;Subunidade;Validade CNH;Status;Data Cadastro') {
    throw new Error('Cabeçalho inesperado em dados_prime_condutores.csv.');
  }

  return lines.map((line, index) => {
    const columns = line.split(';').map(value => value.trim());
    if (columns.length !== 8) {
      throw new Error(`Linha ${index + 2} inválida em dados_prime_condutores.csv.`);
    }

    const [matricula, nome, cnh, unidade, , , status] = columns;
    if (!matricula || !nome || !cnh || !unidade) {
      throw new Error(`Linha ${index + 2} possui campos obrigatórios vazios.`);
    }

    return {
      matricula,
      nome,
      cnh,
      unidade,
      ativo: status.toUpperCase() === 'ATIVO',
    };
  });
}

async function main() {
  const csvUrl = new URL('../dados_prime_condutores.csv', import.meta.url);
  const drivers = parseDrivers(await readFile(csvUrl, 'utf8'));
  const unidades = [...new Set(drivers.map(driver => driver.unidade))];
  const competence = new Date();
  const year = competence.getFullYear();
  const month = competence.getMonth() + 1;
  const secretaryInitialPassword = process.env.SECRETARY_INITIAL_PASSWORD;

  const result = await prisma.$transaction(async tx => {
    await tx.user.upsert({
      where: { matricula: '00001' },
      create: {
        matricula: '00001',
        nome: 'Administrador',
        passwordHash: hashPassword('admin123'),
        role: Role.ADMIN,
        ativo: true,
      },
      update: {
        nome: 'Administrador',
        passwordHash: hashPassword('admin123'),
        role: Role.ADMIN,
        secretariaId: null,
        ativo: true,
      },
    });

    const secretariaIds = new Map<string, number>();
    let secretariasCriadas = 0;
    let motoristasCriados = 0;
    let motoristasAtualizados = 0;
    let veiculosCriados = 0;
    let veiculosAtualizados = 0;

    await tx.municipalFuelQuota.upsert({
      where: { year_month: { year, month } },
      create: { year, month, amountLimit: 300_000 },
      update: { amountLimit: 300_000 },
    });

    for (const item of secretariaQuotas) {
      const existingSecretary = await tx.user.findUnique({
        where: { matricula: item.matricula },
      });
      if (existingSecretary && existingSecretary.role !== Role.SECRETARY) {
        throw new Error(
          `A matrícula ${item.matricula} já pertence a um usuário com perfil ${existingSecretary.role}.`,
        );
      }

      const secretary = existingSecretary
        ? await tx.user.update({
            where: { id: existingSecretary.id },
            data: {
              nome: item.responsavelNome,
              ativo: true,
              ...(secretaryInitialPassword && {
                passwordHash: hashPassword(secretaryInitialPassword),
              }),
            },
          })
        : await tx.user.create({
            data: {
              matricula: item.matricula,
              nome: item.responsavelNome,
              passwordHash: hashPassword(
                secretaryInitialPassword ?? randomBytes(32).toString('hex'),
              ),
              role: Role.SECRETARY,
              ativo: true,
            },
          });

      let secretaria = await tx.secretaria.findFirst({
        where: { OR: [{ sigla: item.sigla }, { nome: item.nome }] },
      });
      if (secretaria) {
        secretaria = await tx.secretaria.update({
          where: { id: secretaria.id },
          data: {
            nome: item.nome,
            sigla: item.sigla,
            responsavelNome: item.responsavelNome,
            secretarioId: secretary.id,
            ativo: true,
          },
        });
      } else {
        secretaria = await tx.secretaria.create({
          data: {
            nome: item.nome,
            sigla: item.sigla,
            responsavelNome: item.responsavelNome,
            secretarioId: secretary.id,
          },
        });
        secretariasCriadas += 1;
      }

      await tx.user.update({
        where: { id: secretary.id },
        data: { secretariaId: secretaria.id },
      });

      await tx.fuelQuota.upsert({
        where: { secretariaId_year_month: { secretariaId: secretaria.id, year, month } },
        create: {
          secretariaId: secretaria.id,
          year,
          month,
          dieselS10Limit: item.dieselS10Limit,
          gasolineLimit: item.gasolineLimit,
          amountLimit: item.dieselS10Limit + item.gasolineLimit,
        },
        update: {
          dieselS10Limit: item.dieselS10Limit,
          gasolineLimit: item.gasolineLimit,
          amountLimit: item.dieselS10Limit + item.gasolineLimit,
        },
      });
    }

    for (const nome of unidades) {
      let secretaria = await tx.secretaria.findFirst({ where: { nome } });
      if (!secretaria) {
        secretaria = await tx.secretaria.create({ data: { nome } });
        secretariasCriadas += 1;
      } else if (!secretaria.ativo) {
        secretaria = await tx.secretaria.update({
          where: { id: secretaria.id },
          data: { ativo: true },
        });
      }
      secretariaIds.set(nome, secretaria.id);
    }

    const fleetSecretariaIds = new Map<string, number>();
    for (const item of fleetSecretarias) {
      const names = [item.nome, ...item.aliases];
      let secretaria = await tx.secretaria.findFirst({
        where: { OR: [{ sigla: item.key }, { nome: { in: names } }] },
      });
      if (secretaria) {
        secretaria = await tx.secretaria.update({
          where: { id: secretaria.id },
          data: { nome: item.nome, ativo: true },
        });
      } else {
        secretaria = await tx.secretaria.create({ data: { nome: item.nome } });
        secretariasCriadas += 1;
      }
      fleetSecretariaIds.set(item.key, secretaria.id);
    }

    for (const [lotacao, placa, descricao] of fleet2026) {
      const secretariaId = fleetSecretariaIds.get(lotacao)!;
      const existing = await tx.vehicle.findUnique({ where: { placa } });
      if (existing) {
        await tx.vehicle.update({
          where: { id: existing.id },
          data: {
            marca: vehicleBrand(descricao),
            modelo: descricao,
            secretariaId,
          },
        });
        veiculosAtualizados += 1;
      } else {
        await tx.vehicle.create({
          data: {
            placa,
            marca: vehicleBrand(descricao),
            modelo: descricao,
            secretariaId,
          },
        });
        veiculosCriados += 1;
      }
    }

    for (const driver of drivers) {
      const existing = await tx.user.findUnique({ where: { matricula: driver.matricula } });
      if (existing && existing.role !== Role.DRIVER) {
        throw new Error(
          `A matrícula ${driver.matricula} já pertence a um usuário com perfil ${existing.role}.`,
        );
      }

      const secretariaId = secretariaIds.get(driver.unidade)!;
      if (existing) {
        await tx.user.update({
          where: { id: existing.id },
          data: { nome: driver.nome, secretariaId, ativo: driver.ativo },
        });
        motoristasAtualizados += 1;
      } else {
        await tx.user.create({
          data: {
            matricula: driver.matricula,
            nome: driver.nome,
            passwordHash: hashPassword(driver.cnh),
            role: Role.DRIVER,
            secretariaId,
            ativo: driver.ativo,
          },
        });
        motoristasCriados += 1;
      }
    }

    return {
      secretariasCriadas,
      motoristasCriados,
      motoristasAtualizados,
      veiculosCriados,
      veiculosAtualizados,
    };
  });

  console.log(
    `Seed concluído: administrador 00001 configurado, ${drivers.length} motoristas sincronizados, ` +
      `${result.motoristasCriados} criados, ${result.motoristasAtualizados} atualizados e ` +
      `${result.secretariasCriadas} secretarias criadas; ${fleet2026.length} itens da frota sincronizados, ` +
      `${result.veiculosCriados} criados e ${result.veiculosAtualizados} atualizados.`,
  );
}

main()
  .catch(error => {
    console.error('Falha ao executar o seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
