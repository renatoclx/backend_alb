import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RentalService } from './rental.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { RentalQueryDto } from './dto/rental-query.dto';
import { ReturnItemsDto } from './dto/return-items.dto';

@Controller('rentals')
export class RentalController {
  constructor(private readonly rentalService: RentalService) {}

  @Post()
  create(@Body() dto: CreateRentalDto) {
    return this.rentalService.create(dto);
  }

  @Get()
  findAll(@Query() query: RentalQueryDto) {
    return this.rentalService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rentalService.findOne(id);
  }

  @Patch(':id/return')
  returnRental(@Param('id') id: string) {
    return this.rentalService.returnRental(id);
  }

  @Post(':id/returns')
  returnItems(@Param('id') id: string, @Body() dto: ReturnItemsDto) {
    return this.rentalService.returnItems(id, dto);
  }
}
