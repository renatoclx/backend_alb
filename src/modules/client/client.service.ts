import {
  BadRequestException,
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
import { CityService } from '../city/city.service';
import { SaleService } from '../sale/sale.service';
import { RentalService } from '../rental/rental.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientQueryDto } from './dto/client-query.dto';
import { ClientEntity } from './entities/client.entity';

@Injectable()
export class ClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cityService: CityService,
    @Inject(forwardRef(() => SaleService))
    private readonly saleService: SaleService,
    @Inject(forwardRef(() => RentalService))
    private readonly rentalService: RentalService,
  ) {}

  async create(dto: CreateClientDto): Promise<ClientEntity> {
    await this.cityService.findOne(dto.cityId);

    if (dto.email) {
      await this.ensureEmailIsUnique(dto.email);
    }
    await this.ensureDocumentIsUnique(dto.document);

    return this.prisma.client.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        document: dto.document,
        address: dto.address,
        cityId: dto.cityId,
      },
    });
  }

  async findAll(query: ClientQueryDto): Promise<PaginatedResult<ClientEntity>> {
    const { page, limit, includeDeleted } = query;
    const where = includeDeleted ? {} : { deletedAt: null };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return paginate(clients, total, page, limit);
  }

  async findOne(id: string): Promise<ClientEntity> {
    return this.findOrThrow(id);
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientEntity> {
    await this.findOrThrow(id);

    if ((dto.address && !dto.cityId) || (dto.cityId && !dto.address)) {
      throw new BadRequestException(
        'address e cityId devem ser informados juntos ao alterar o endereço',
      );
    }

    if (dto.cityId) {
      await this.cityService.findOne(dto.cityId);
    }

    if (dto.email) {
      await this.ensureEmailIsUnique(dto.email, id);
    }

    if (dto.document) {
      await this.ensureDocumentIsUnique(dto.document, id);
    }

    return this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        document: dto.document,
        address: dto.address,
        cityId: dto.cityId,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);

    const [hasSales, hasRentals] = await Promise.all([
      this.saleService.existsForClient(id),
      this.rentalService.existsForClient(id),
    ]);

    if (hasSales || hasRentals) {
      throw new ConflictException(
        'Cliente possui histórico de compras ou locações e não pode ser excluído',
      );
    }

    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<ClientEntity> {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (!client.deletedAt) {
      throw new ConflictException('Cliente não está removido');
    }

    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  private async findOrThrow(id: string): Promise<ClientEntity> {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return client;
  }

  private async ensureEmailIsUnique(
    email: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.client.findFirst({ where: { email } });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException('Email já está em uso');
    }
  }

  private async ensureDocumentIsUnique(
    document: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.client.findFirst({
      where: { document },
    });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException('Documento já está em uso');
    }
  }
}
