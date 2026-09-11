import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, RentalStatus } from '../../../generated/prisma/client';
import {
  paginate,
  paginationSkip,
} from '../../common/helpers/pagination.helper';
import { ensureNoDuplicateProductIds } from '../../common/helpers/duplicate-check.helper';
import { computeRentalStatus } from '../../common/helpers/rental-status.helper';
import { containsInsensitive } from '../../common/helpers/search.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { ClientService } from '../client/client.service';
import { ProductService } from '../product/product.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import {
  RentalQueryDto,
  type RentalStatusFilter,
} from './dto/rental-query.dto';
import { RentalEntity } from './entities/rental.entity';

// Nome do cliente/cidade e nome de cada produto vêm junto — o frontend não
// precisa mais cruzar com /clients e /products pra montar a listagem.
const RENTAL_INCLUDE = {
  client: {
    select: {
      name: true,
      document: true,
      phone: true,
      city: { select: { name: true } },
    },
  },
  items: { include: { product: { select: { name: true } } } },
} satisfies Prisma.RentalInclude;

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
        include: RENTAL_INCLUDE,
      });
    });
  }

  async findAll(query: RentalQueryDto): Promise<PaginatedResult<RentalEntity>> {
    const { page, limit, search, status } = query;
    const nameFilter = containsInsensitive(search);
    const where: Prisma.RentalWhereInput = {
      ...(nameFilter ? { client: { name: nameFilter } } : {}),
      ...this.statusWhere(status),
    };

    const [rentals, total] = await Promise.all([
      this.prisma.rental.findMany({
        where,
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: RENTAL_INCLUDE,
      }),
      this.prisma.rental.count({ where }),
    ]);

    return paginate(
      rentals.map((rental) => this.withComputedStatus(rental)),
      total,
      page,
      limit,
    );
  }

  private statusWhere(status?: RentalStatusFilter): Prisma.RentalWhereInput {
    const now = new Date();
    if (status === 'devolvida') {
      return { status: RentalStatus.RETURNED };
    }
    if (status === 'ativa') {
      return { status: RentalStatus.ACTIVE, expectedReturnDate: { gte: now } };
    }
    if (status === 'atrasada') {
      return { status: RentalStatus.ACTIVE, expectedReturnDate: { lt: now } };
    }
    return {};
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
        include: RENTAL_INCLUDE,
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

  private withComputedStatus<
    T extends { status: RentalStatus; expectedReturnDate: Date },
  >(rental: T): T {
    return { ...rental, status: computeRentalStatus(rental) };
  }

  private async findOrThrow(id: string) {
    const rental = await this.prisma.rental.findUnique({
      where: { id },
      include: RENTAL_INCLUDE,
    });
    if (!rental) {
      throw new NotFoundException('Locação não encontrada');
    }
    return rental;
  }
}
