import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import { hashPassword } from '../src/server/auth/password';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./prisma/database.db',
});
const prisma = new PrismaClient({ adapter });

type CsvDriver = {
  matricula: string;
  nome: string;
  cnh: string;
  unidade: string;
  ativo: boolean;
};

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

    return { secretariasCriadas, motoristasCriados, motoristasAtualizados };
  });

  console.log(
    `Seed concluído: administrador 00001 configurado, ${drivers.length} motoristas sincronizados, ` +
      `${result.motoristasCriados} criados, ${result.motoristasAtualizados} atualizados e ` +
      `${result.secretariasCriadas} secretarias criadas.`,
  );
}

main()
  .catch(error => {
    console.error('Falha ao executar o seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
