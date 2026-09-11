import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const REVENUE_PERIODS = [7, 30, 90] as const;

export class RevenueQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([...REVENUE_PERIODS])
  days: number = 30;
}
