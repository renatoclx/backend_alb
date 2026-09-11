import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const RENTAL_STATUS_FILTERS = [
  'ativa',
  'devolvida',
  'atrasada',
] as const;
export type RentalStatusFilter = (typeof RENTAL_STATUS_FILTERS)[number];

export class RentalQueryDto extends PaginationQueryDto {
  // Busca pelo nome do cliente (case-insensitive, substring).
  @IsOptional()
  @IsString()
  search?: string;

  // "atrasada" é derivado (ACTIVE + data prevista vencida), não um valor
  // persistido — a tradução para o `where` fica no service.
  @IsOptional()
  @IsIn([...RENTAL_STATUS_FILTERS])
  status?: RentalStatusFilter;
}
