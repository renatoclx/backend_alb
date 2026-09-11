import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CityQueryDto extends PaginationQueryDto {
  // Busca por nome (case-insensitive, substring).
  @IsOptional()
  @IsString()
  search?: string;
}
