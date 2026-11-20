export class RentalReturnItemEntity {
  id!: string;
  rentalReturnId!: string;
  rentalItemId!: string;
  quantity!: number;
}

export class RentalReturnEntity {
  id!: string;
  rentalId!: string;
  returnedAt!: Date;
  items!: RentalReturnItemEntity[];
  createdAt!: Date;
}
