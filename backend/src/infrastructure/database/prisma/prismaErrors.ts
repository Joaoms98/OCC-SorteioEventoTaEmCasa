import { Prisma } from './generated/client.ts';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export const isUniqueConstraintViolation = (error: unknown): boolean => hasCode(error, UNIQUE_CONSTRAINT_VIOLATION);
export const isForeignKeyViolation = (error: unknown): boolean => hasCode(error, FOREIGN_KEY_VIOLATION);
