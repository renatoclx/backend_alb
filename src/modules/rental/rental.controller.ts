import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RentalService } from './rental.service';
import { CreateRentalDto } from './dto/create-rental.dto';

@Controller('rentals')
export class RentalController {
  constructor(private readonly rentalService: RentalService) {}

  @Post()
  create(@Body() dto: CreateRentalDto) {
    return this.rentalService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
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
}
