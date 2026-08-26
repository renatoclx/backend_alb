import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ProductType } from '../../../../generated/prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ProductType)
  type!: ProductType;

  @IsNumber()
  @Min(0)
  purchasePrice!: number;

  // Obrigatoriedade condicionada ao `type` é aplicada no service, não aqui:
  // quando type=SALE, salePrice é usado e rentalPrice é sempre gravado como
  // null (e vice-versa para RENTAL) — ver ProductService.create().
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rentalPrice?: number;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsInt()
  @Min(0)
  minimalQuantity!: number;

  @IsUUID()
  categoryId!: string;
}
