import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RentalStatus } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  paginate,
  paginationSkip,
} from '../../common/helpers/pagination.helper';
import { ensureNoDuplicateProductIds } from '../../common/helpers/duplicate-check.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { ClientService } from '../client/client.service';
import { ProductService } from '../product/product.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { RentalEntity } from './entities/rental.entity';

@Injectable()
export class RentalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
  ) {}

  async create(dto: CreateRentalDto): Promise<RentalEntity> {
    await this.clientService.findOne(dto.clientId);
    ensureNoDuplicateProductIds(dto.items);

    const expectedReturnDate = new Date(dto.expectedReturnDate);
    if (expectedReturnDate.getTime() <= Date.now()) {
      throw new BadRequestException(
        'expectedReturnDate deve ser uma data futura',
      );
    }

    const products = await Promise.all(
      dto.items.map((item) => this.productService.findOne(item.productId)),
    );

    let total = 0;
    const itemsData = dto.items.map((item, index) => {
      const product = products[index];
      if (product.rentalPrice == null) {
        throw new BadRequestException(
          `Produto ${product.id} não está disponível para locação`,
        );
      }
      const unitPrice = Number(product.rentalPrice);
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

      return tx.rental.create({
        data: {
          clientId: dto.clientId,
          total,
          expectedReturnDate,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    });
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<RentalEntity>> {
    const { page, limit } = query;

    const [rentals, total] = await Promise.all([
      this.prisma.rental.findMany({
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.prisma.rental.count(),
    ]);

    return paginate(
      rentals.map((rental) => this.withComputedStatus(rental)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<RentalEntity> {
    return this.withComputedStatus(await this.findOrThrow(id));
  }

  async returnRental(id: string): Promise<RentalEntity> {
    const rental = await this.findOrThrow(id);

    if (rental.status === RentalStatus.RETURNED) {
      throw new ConflictException('Locação já foi devolvida');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of rental.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { increment: item.quantity },
            updatedAt: new Date(),
          },
        });
      }

      return tx.rental.update({
        where: { id },
        data: {
          status: RentalStatus.RETURNED,
          returnedAt: new Date(),
          updatedAt: new Date(),
        },
        include: { items: true },
      });
    });
  }

  async existsForClient(clientId: string): Promise<boolean> {
    const count = await this.prisma.rental.count({ where: { clientId } });
    return count > 0;
  }

  async existsForProduct(productId: string): Promise<boolean> {
    const count = await this.prisma.rentalItem.count({
      where: { productId },
    });
    return count > 0;
  }

  private withComputedStatus(rental: RentalEntity): RentalEntity {
    if (
      rental.status === RentalStatus.ACTIVE &&
      rental.expectedReturnDate.getTime() < Date.now()
    ) {
      return { ...rental, status: RentalStatus.DELAY };
    }
    return rental;
  }

  private async findOrThrow(id: string): Promise<RentalEntity> {
    const rental = await this.prisma.rental.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!rental) {
      throw new NotFoundException('Locação não encontrada');
    }
    return rental;
  }
}
