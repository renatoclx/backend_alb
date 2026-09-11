export class CategoryEntity {
  id!: string;
  name!: string;
  // Quantidade de produtos vinculados (inclui os removidos logicamente —
  // mesma base da regra que bloqueia a exclusão). Presente no findAll.
  productsCount?: number;
  createdAt!: Date;
  updatedAt!: Date | null;
}
