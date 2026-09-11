import { ProductType } from '../../../../generated/prisma/client';

export class ProductEntity {
  id!: string;
  name!: string;
  reference!: string | null;
  description!: string | null;
  type!: ProductType;
  purchasePrice: unknown;
  salePrice: unknown;
  rentalPrice: unknown;
  quantity!: number;
  minimalQuantity!: number;
  categoryId!: string;
  // Preenchido na listagem (PRODUCT_INCLUDE).
  category?: { name: string };
  createdAt!: Date;
  updatedAt!: Date | null;
  deletedAt!: Date | null;
}
