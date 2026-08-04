export class ProductEntity {
  id: string;
  name: string;
  reference: string | null;
  description: string | null;
  purchasePrice: unknown;
  salePrice: unknown;
  rentalPrice: unknown;
  quantity: number;
  minimalQuantity: number;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
