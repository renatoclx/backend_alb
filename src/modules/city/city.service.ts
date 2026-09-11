import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import {
  paginate,
  paginationSkip,
} from '../../common/helpers/pagination.helper';
import { containsInsensitive } from '../../common/helpers/search.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { CityQueryDto } from './dto/city-query.dto';
import { CityEntity } from './entities/city.entity';

@Injectable()
export class CityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CityQueryDto): Promise<PaginatedResult<CityEntity>> {
    const { page, limit, search } = query;
    const nameFilter = containsInsensitive(search);
    const where: Prisma.CityWhereInput = nameFilter ? { name: nameFilter } : {};

    const [cities, total] = await Promise.all([
      this.prisma.city.findMany({
        where,
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.city.count({ where }),
    ]);

    return paginate(cities, total, page, limit);
  }

  async findOne(id: string): Promise<CityEntity> {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) {
      throw new NotFoundException('Cidade não encontrada');
    }
    return city;
  }
}
