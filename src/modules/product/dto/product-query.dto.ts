import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ProductType } from '../../../../generated/prisma/client';

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeDeleted: boolean = true;

  // Busca por nome (case-insensitive, substring).
  @IsOptional()
  @IsString()
  search?: string;

  // Filtra por tipo (SALE | RENTAL) — usado nos lançamentos de venda/locação.
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;
}
