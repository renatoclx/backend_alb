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

export function ensureNoDuplicateRentalItemIds(
  items: { rentalItemId: string }[],
): void {
  const ids = items.map((item) => item.rentalItemId);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(
      'Não é permitido repetir o mesmo item na lista de devolução',
    );
  }
}
