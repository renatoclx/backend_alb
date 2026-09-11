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
  // Preenchido no create/findAll/findOne/return (RENTAL_INCLUDE).
  client?: {
    name: string;
    document: string;
    phone: string;
    city: { name: string } | null;
  };
  createdAt!: Date;
  updatedAt!: Date | null;
}
