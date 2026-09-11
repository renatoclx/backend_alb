import { SaleItemEntity } from './sale-item.entity';

export class SaleEntity {
  id!: string;
  clientId!: string;
  total: unknown;
  items!: SaleItemEntity[];
  // Preenchido no create/findAll/findOne (SALE_INCLUDE).
  client?: {
    name: string;
    document: string;
    phone: string;
    city: { name: string } | null;
  };
  createdAt!: Date;
  updatedAt!: Date | null;
}
