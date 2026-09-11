import { Prisma } from '../../../generated/prisma/client';

// Filtro de busca textual: substring, case-insensitive. Retorna `undefined`
// quando não há termo, pra ser aplicado condicionalmente dentro de um `where`.
export function containsInsensitive(
  value: string | undefined | null,
): Prisma.StringFilter | undefined {
  const term = value?.trim();
  return term ? { contains: term, mode: 'insensitive' } : undefined;
}
