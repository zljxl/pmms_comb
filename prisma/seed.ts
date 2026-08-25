import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./prisma/database.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Nenhum usuário criado pelo seed. O primeiro login criará o administrador.');
}
main().finally(() => prisma.$disconnect());
