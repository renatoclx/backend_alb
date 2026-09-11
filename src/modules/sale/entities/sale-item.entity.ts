export class SaleItemEntity {
  id!: string;
  saleId!: string;
  productId!: string;
  quantity!: number;
  unitPrice: unknown;
  // Preenchido junto da venda (SALE_INCLUDE).
  product?: { name: string };
  createdAt!: Date;
  updatedAt!: Date | null;
}
