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
import { ensureNoDuplicateProductIds } from '../../common/helpers/duplicate-check.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { ClientService } from '../client/client.service';
import { ProductService } from '../product/product.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleEntity } from './entities/sale.entity';

@Injectable()
export class SaleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
  ) {}

  async create(dto: CreateSaleDto): Promise<SaleEntity> {
    await this.clientService.findOne(dto.clientId);
    ensureNoDuplicateProductIds(dto.items);

    const products = await Promise.all(
      dto.items.map((item) => this.productService.findOne(item.productId)),
    );

    let total = 0;
    const itemsData = dto.items.map((item, index) => {
      const unitPrice = Number(products[index].salePrice);
      total += unitPrice * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new ConflictException(
            `Estoque insuficiente para o produto ${item.productId}`,
          );
        }
      }

      return tx.sale.create({
        data: {
          clientId: dto.clientId,
          total,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    });
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<SaleEntity>> {
    const { page, limit } = query;

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.sale.count(),
    ]);

    return paginate(sales, total, page, limit);
  }

  async findOne(id: string): Promise<SaleEntity> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }
    return sale;
  }

  async existsForClient(clientId: string): Promise<boolean> {
    const count = await this.prisma.sale.count({ where: { clientId } });
    return count > 0;
  }

  async existsForProduct(productId: string): Promise<boolean> {
    const count = await this.prisma.saleItem.count({ where: { productId } });
    return count > 0;
  }
}
