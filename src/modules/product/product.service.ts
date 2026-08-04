import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  paginate,
  paginationSkip,
} from '../../common/helpers/pagination.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { CategoryService } from '../category/category.service';
import { SaleService } from '../sale/sale.service';
import { RentalService } from '../rental/rental.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductEntity } from './entities/product.entity';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: CategoryService,
    @Inject(forwardRef(() => SaleService))
    private readonly saleService: SaleService,
    @Inject(forwardRef(() => RentalService))
    private readonly rentalService: RentalService,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    await this.categoryService.findOne(dto.categoryId);

    if (dto.reference) {
      await this.ensureReferenceIsUnique(dto.categoryId, dto.reference);
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        reference: dto.reference,
        description: dto.description,
        purchasePrice: dto.purchasePrice,
        salePrice: dto.salePrice,
        rentalPrice: dto.rentalPrice,
        quantity: dto.quantity,
        minimalQuantity: dto.minimalQuantity,
        categoryId: dto.categoryId,
      },
    });
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ProductEntity>> {
    const { page, limit } = query;
    const where = { deletedAt: null };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(products, total, page, limit);
  }

  async findOne(id: string): Promise<ProductEntity> {
    return this.findOrThrow(id);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const product = await this.findOrThrow(id);

    if (dto.categoryId) {
      await this.categoryService.findOne(dto.categoryId);
    }

    const effectiveCategoryId = dto.categoryId ?? product.categoryId;
    const effectiveReference = dto.reference ?? product.reference;

    if ((dto.categoryId || dto.reference) && effectiveReference) {
      await this.ensureReferenceIsUnique(
        effectiveCategoryId,
        effectiveReference,
        id,
      );
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        reference: dto.reference,
        description: dto.description,
        purchasePrice: dto.purchasePrice,
        salePrice: dto.salePrice,
        rentalPrice: dto.rentalPrice,
        quantity: dto.quantity,
        minimalQuantity: dto.minimalQuantity,
        categoryId: dto.categoryId,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);

    const [hasSales, hasRentals] = await Promise.all([
      this.saleService.existsForProduct(id),
      this.rentalService.existsForProduct(id),
    ]);

    if (hasSales || hasRentals) {
      throw new ConflictException(
        'Produto possui histórico de vendas ou locações e não pode ser excluído',
      );
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async findOrThrow(id: string): Promise<ProductEntity> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  private async ensureReferenceIsUnique(
    categoryId: string,
    reference: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: { categoryId, reference },
    });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(
        'Já existe um produto com essa referência nesta categoria',
      );
    }
  }
}
