import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class SaleQueryDto extends PaginationQueryDto {
  // Busca pelo nome do cliente (case-insensitive, substring).
  @IsOptional()
  @IsString()
  search?: string;

  // Busca pelo nome de um dos produtos vendidos.
  @IsOptional()
  @IsString()
  productSearch?: string;
}
