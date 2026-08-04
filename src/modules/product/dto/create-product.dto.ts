import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @IsNumber()
  @Min(0)
  salePrice: number;

  @IsNumber()
  @Min(0)
  rentalPrice: number;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsInt()
  @Min(0)
  minimalQuantity: number;

  @IsUUID()
  categoryId: string;
}
