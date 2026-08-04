import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { TransactionItemDto } from '../../../common/dto/transaction-item.dto';

export class CreateSaleDto {
  @IsUUID()
  clientId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  items: TransactionItemDto[];
}
