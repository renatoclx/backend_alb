import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  paginate,
  paginationSkip,
} from '../../common/helpers/pagination.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryEntity } from './entities/category.entity';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    await this.ensureNameIsUnique(dto.name);

    return this.prisma.category.create({ data: { name: dto.name } });
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CategoryEntity>> {
    const { page, limit } = query;

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.count(),
    ]);

    return paginate(categories, total, page, limit);
  }

  async findOne(id: string): Promise<CategoryEntity> {
    return this.findOrThrow(id);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    await this.findOrThrow(id);

    if (dto.name) {
      await this.ensureNameIsUnique(dto.name, id);
    }

    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, updatedAt: new Date() },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);

    const linkedProductsCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (linkedProductsCount > 0) {
      throw new ConflictException(
        'Não é possível excluir uma categoria com produtos vinculados',
      );
    }

    await this.prisma.category.delete({ where: { id } });
  }

  private async findOrThrow(id: string): Promise<CategoryEntity> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return category;
  }

  private async ensureNameIsUnique(
    name: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.category.findUnique({
      where: { name },
    });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException('Já existe uma categoria com esse nome');
    }
  }
}
