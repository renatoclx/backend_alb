import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Controller('sales')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.saleService.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.saleService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.saleService.findOne(id);
  }
}
