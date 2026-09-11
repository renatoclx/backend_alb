import { RentalStatus } from '../../../../generated/prisma/client';

export type MovementType = 'RENTAL' | 'SALE';

// Vendas não têm status; usam este valor fixo nas "Últimas movimentações".
export type MovementStatus = RentalStatus | 'CONCLUDED';

export class DashboardMetricsEntity {
  // Receita faturada no mês corrente (locações + vendas), pelo createdAt.
  monthRevenue!: number;
  // Locações com status ACTIVE (inclui as vencidas — em andamento).
  activeRentals!: number;
  monthSales!: number;
  // Clientes distintos com locação ativa OU ao menos uma venda no mês.
  activeClients!: number;
}

export class RevenuePointEntity {
  date!: string; // YYYY-MM-DD
  rentals!: number;
  sales!: number;
  total!: number;
}

export class RecentMovementEntity {
  id!: string;
  type!: MovementType;
  client!: string;
  total!: number;
  date!: Date;
  status!: MovementStatus;
}

export class UpcomingReturnEntity {
  id!: string;
  client!: string;
  expectedReturnDate!: Date;
  status!: RentalStatus;
  daysOverdue!: number;
}
