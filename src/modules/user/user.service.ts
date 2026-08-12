import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  paginate,
  paginationSkip,
} from '../../common/helpers/pagination.helper';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserEntity } from './entities/user.entity';

const SALT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email já está em uso');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
    });

    return this.toEntity(user);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<UserEntity>> {
    const { page, limit } = query;
    const where = { deletedAt: null };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: paginationSkip(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(
      users.map((user) => this.toEntity(user)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.findNotDeletedOrThrow(id);
    return this.toEntity(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    await this.findNotDeletedOrThrow(id);

    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email já está em uso');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        updatedAt: new Date(),
      },
    });

    return this.toEntity(user);
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findNotDeletedOrThrow(id);

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Senha atual inválida');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword, updatedAt: new Date() },
    });
  }

  async inactivate(id: string): Promise<UserEntity> {
    await this.findNotDeletedOrThrow(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });

    return this.toEntity(user);
  }

  async reactivate(id: string): Promise<UserEntity> {
    await this.findNotDeletedOrThrow(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true, updatedAt: new Date() },
    });

    return this.toEntity(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findNotDeletedOrThrow(id);

    if (user.isActive) {
      throw new ConflictException(
        'Apenas usuários inativos podem ser removidos',
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });
  }

  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  private async findNotDeletedOrThrow(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  private toEntity(user: UserEntity & { password: string }): UserEntity {
    const { id, name, email, isActive, createdAt, updatedAt, deletedAt } = user;
    return { id, name, email, isActive, createdAt, updatedAt, deletedAt };
  }
}
