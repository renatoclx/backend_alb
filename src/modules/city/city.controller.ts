import { Controller, Get, Param, Query } from '@nestjs/common';
import { CityService } from './city.service';
import { CityQueryDto } from './dto/city-query.dto';

@Controller('cities')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @Get()
  findAll(@Query() query: CityQueryDto) {
    return this.cityService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cityService.findOne(id);
  }
}
