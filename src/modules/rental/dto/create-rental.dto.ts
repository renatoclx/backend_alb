import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { TransactionItemDto } from '../../../common/dto/transaction-item.dto';

export class CreateRentalDto {
  @IsUUID()
  clientId!: string;

  @IsDateString()
  expectedReturnDate!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  items!: TransactionItemDto[];
}
