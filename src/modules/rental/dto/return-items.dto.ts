import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReturnItemDto {
  @IsUUID()
  rentalItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

// Devolução avulsa: quais itens da locação (e quantas unidades de cada)
// estão voltando agora. O limite por item (o que falta devolver) é validado
// no service.
export class ReturnItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];
}
