import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  paginate,
  paginationSkip,
} from '../../common/helpers/pagination.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { CityEntity } from './entities/city.entity';

@Injectable()
export class CityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CityEntity>> {
    const { page, limit } = query;

    const [cities, total] = await Promise.all([
      this.prisma.city.findMany({
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.city.count(),
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
