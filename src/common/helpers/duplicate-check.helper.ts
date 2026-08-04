import { BadRequestException } from '@nestjs/common';

export function ensureNoDuplicateProductIds(
  items: { productId: string }[],
): void {
  const ids = items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(
      'Não é permitido repetir o mesmo produto na lista de itens',
    );
  }
}
