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
import {
  ensureNoDuplicateProductIds,
  ensureNoDuplicateRentalItemIds,
} from '../../common/helpers/duplicate-check.helper';
import { computeRentalStatus } from '../../common/helpers/rental-status.helper';
import { containsInsensitive } from '../../common/helpers/search.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { ClientService } from '../client/client.service';
import { ProductService } from '../product/product.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { ReturnItemsDto } from './dto/return-items.dto';
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
  // Histórico de devoluções (parciais e total), da mais antiga à mais recente.
  returns: { include: { items: true }, orderBy: { returnedAt: 'asc' } },
} satisfies Prisma.RentalInclude;

type RentalWithIncludes = Prisma.RentalGetPayload<{
  include: typeof RENTAL_INCLUDE;
}>;

interface ItemToReturn {
  rentalItemId: string;
  productId: string;
  quantity: number;
}

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
    if (status === 'devolucao_parcial') {
      return {
        status: RentalStatus.PARTIALLY_RETURNED,
        expectedReturnDate: { gte: now },
      };
    }
    if (status === 'atrasada') {
      return {
        status: {
          in: [RentalStatus.ACTIVE, RentalStatus.PARTIALLY_RETURNED],
        },
        expectedReturnDate: { lt: now },
      };
    }
    return {};
  }

  async findOne(id: string): Promise<RentalEntity> {
    return this.withComputedStatus(await this.findOrThrow(id));
  }

  // Devolução total: devolve tudo o que ainda falta de cada item (após
  // eventuais devoluções parciais) e encerra a locação.
  async returnRental(id: string): Promise<RentalEntity> {
    const rental = await this.findOrThrow(id);
    this.ensureNotReturned(rental);

    const remaining = this.remainingByItem(rental);
    const items: ItemToReturn[] = rental.items
      .filter((item) => (remaining.get(item.id) ?? 0) > 0)
      .map((item) => ({
        rentalItemId: item.id,
        productId: item.productId,
        quantity: remaining.get(item.id) ?? 0,
      }));

    return this.registerReturn(rental.id, items, true);
  }

  // Devolução avulsa: devolve só os itens/quantidades informados. Se com
  // ela não sobrar nada pendente, a locação é encerrada como devolvida.
  async returnItems(id: string, dto: ReturnItemsDto): Promise<RentalEntity> {
    const rental = await this.findOrThrow(id);
    this.ensureNotReturned(rental);
    ensureNoDuplicateRentalItemIds(dto.items);

    const remaining = this.remainingByItem(rental);
    const items: ItemToReturn[] = dto.items.map((dtoItem) => {
      const rentalItem = rental.items.find(
        (item) => item.id === dtoItem.rentalItemId,
      );
      if (!rentalItem) {
        throw new BadRequestException(
          `Item ${dtoItem.rentalItemId} não pertence a esta locação`,
        );
      }
      const pending = remaining.get(rentalItem.id) ?? 0;
      if (dtoItem.quantity > pending) {
        throw new BadRequestException(
          `${rentalItem.product.name}: quantidade a devolver é maior que a pendente (${pending})`,
        );
      }
      remaining.set(rentalItem.id, pending - dtoItem.quantity);
      return {
        rentalItemId: rentalItem.id,
        productId: rentalItem.productId,
        quantity: dtoItem.quantity,
      };
    });

    const fullyReturned = [...remaining.values()].every((qty) => qty === 0);
    return this.registerReturn(rental.id, items, fullyReturned);
  }

  // Grava a devolução, restaura o estoque e atualiza o status — numa
  // transação única.
  private async registerReturn(
    rentalId: string,
    items: ItemToReturn[],
    fullyReturned: boolean,
  ): Promise<RentalEntity> {
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity }, updatedAt: now },
        });
      }

      if (items.length > 0) {
        await tx.rentalReturn.create({
          data: {
            rentalId,
            returnedAt: now,
            items: {
              create: items.map((item) => ({
                rentalItemId: item.rentalItemId,
                quantity: item.quantity,
              })),
            },
          },
        });
      }

      return tx.rental.update({
        where: { id: rentalId },
        data: fullyReturned
          ? { status: RentalStatus.RETURNED, returnedAt: now, updatedAt: now }
          : { status: RentalStatus.PARTIALLY_RETURNED, updatedAt: now },
        include: RENTAL_INCLUDE,
      });
    });
    return this.withComputedStatus(updated);
  }

  private ensureNotReturned(rental: { status: RentalStatus }): void {
    if (rental.status === RentalStatus.RETURNED) {
      throw new ConflictException('Locação já foi devolvida');
    }
  }

  // Quanto ainda falta devolver de cada item: quantidade locada menos a
  // soma do que já voltou nas devoluções anteriores.
  private remainingByItem(rental: RentalWithIncludes): Map<string, number> {
    const remaining = new Map(
      rental.items.map((item) => [item.id, item.quantity]),
    );
    for (const rentalReturn of rental.returns) {
      for (const returned of rentalReturn.items) {
        remaining.set(
          returned.rentalItemId,
          (remaining.get(returned.rentalItemId) ?? 0) - returned.quantity,
        );
      }
    }
    return remaining;
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
