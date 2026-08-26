import { RentalStatus } from '../../../../generated/prisma/client';
import { RentalItemEntity } from './rental-item.entity';

export class RentalEntity {
  id!: string;
  clientId!: string;
  total: unknown;
  startDate!: Date;
  expectedReturnDate!: Date;
  returnedAt!: Date | null;
  status!: RentalStatus;
  items!: RentalItemEntity[];
  createdAt!: Date;
  updatedAt!: Date | null;
}
