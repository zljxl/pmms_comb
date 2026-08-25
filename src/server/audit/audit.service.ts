import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { prisma } from '../database/prisma';
type Input = {
  userId?: number;
  action: string;
  entity: string;
  entityId?: number | string;
  description?: string;
  oldData?: unknown;
  newData?: unknown;
};
export function audit(input: Input, db: Prisma.TransactionClient | PrismaClient = prisma) {
  return db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId?.toString(),
      description: input.description,
      oldData: input.oldData === undefined ? undefined : JSON.stringify(input.oldData),
      newData: input.newData === undefined ? undefined : JSON.stringify(input.newData),
    },
  });
}
