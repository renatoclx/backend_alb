export class RentalItemEntity {
  id!: string;
  rentalId!: string;
  productId!: string;
  quantity!: number;
  unitPrice: unknown;
  // Preenchido junto da locação (RENTAL_INCLUDE).
  product?: { name: string };
  createdAt!: Date;
  updatedAt!: Date | null;
}
