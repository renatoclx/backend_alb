import { RentalStatus } from '../../../generated/prisma/client';

// Uma locação ACTIVE ou PARTIALLY_RETURNED (ainda há itens com o cliente)
// cuja data prevista de devolução já passou é exibida como DELAY. O status DELAY nunca é persistido — é sempre derivado na
// leitura, aqui e no RentalService.
export function computeRentalStatus(rental: {
  status: RentalStatus;
  expectedReturnDate: Date;
}): RentalStatus {
  if (
    (rental.status === RentalStatus.ACTIVE ||
      rental.status === RentalStatus.PARTIALLY_RETURNED) &&
    rental.expectedReturnDate.getTime() < Date.now()
  ) {
    return RentalStatus.DELAY;
  }
  return rental.status;
}
