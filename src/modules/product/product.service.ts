import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductEntity } from './entities/product.entity';
import { ProductType } from '../../../generated/prisma/client';

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

    const { salePrice, rentalPrice } = this.resolvePricesByType(
      dto.type,
      dto,
    );

    return this.prisma.product.create({
      data: {
        name: dto.name,
        reference: dto.reference,
        description: dto.description,
        type: dto.type,
        purchasePrice: dto.purchasePrice,
        salePrice,
        rentalPrice,
        quantity: dto.quantity,
        minimalQuantity: dto.minimalQuantity,
        categoryId: dto.categoryId,
      },
    });
  }

  async findAll(
    query: ProductQueryDto,
  ): Promise<PaginatedResult<ProductEntity>> {
    const { page, limit, includeDeleted } = query;
    const where = includeDeleted ? {} : { deletedAt: null };

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

    const effectiveType = dto.type ?? product.type;
    const existingSalePrice =
      product.salePrice != null ? Number(product.salePrice) : undefined;
    const existingRentalPrice =
      product.rentalPrice != null ? Number(product.rentalPrice) : undefined;
    const { salePrice, rentalPrice } = this.resolvePricesByType(
      effectiveType,
      {
        salePrice: dto.salePrice ?? existingSalePrice,
        rentalPrice: dto.rentalPrice ?? existingRentalPrice,
      },
    );

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        reference: dto.reference,
        description: dto.description,
        type: dto.type,
        purchasePrice: dto.purchasePrice,
        salePrice,
        rentalPrice,
        quantity: dto.quantity,
        minimalQuantity: dto.minimalQuantity,
        categoryId: dto.categoryId,
        updatedAt: new Date(),
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
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });
  }

  async restore(id: string): Promise<ProductEntity> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    if (!product.deletedAt) {
      throw new ConflictException('Produto não está removido');
    }

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: null, updatedAt: new Date() },
    });
  }

  // O preço do tipo não selecionado é sempre gravado como null, mesmo que
  // tenha vindo algo no payload — quem decide qual preço é "o preço" do
  // produto é o `type`, não o que o cliente mandou.
  private resolvePricesByType(
    type: ProductType,
    prices: { salePrice?: number; rentalPrice?: number },
  ): { salePrice: number | null; rentalPrice: number | null } {
    if (type === ProductType.SALE) {
      return { salePrice: prices.salePrice ?? null, rentalPrice: null };
    }
    return { salePrice: null, rentalPrice: prices.rentalPrice ?? null };
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
