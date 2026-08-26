import { SaleItemEntity } from './sale-item.entity';

export class SaleEntity {
  id!: string;
  clientId!: string;
  total: unknown;
  items!: SaleItemEntity[];
  createdAt!: Date;
  updatedAt!: Date | null;
}
