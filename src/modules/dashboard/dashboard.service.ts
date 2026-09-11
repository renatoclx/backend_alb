import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RentalStatus } from '../../../generated/prisma/client';
import { computeRentalStatus } from '../../common/helpers/rental-status.helper';
import {
  DashboardMetricsEntity,
  RecentMovementEntity,
  RevenuePointEntity,
  UpcomingReturnEntity,
} from './entities/dashboard.entity';

const RECENT_MOVEMENTS_LIMIT = 10;
const UPCOMING_RETURNS_LIMIT = 10;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const METRICS_CACHE_TTL_MS = 60 * 1000;

function appTimeZone(): string {
  return process.env.APP_TIMEZONE?.trim() || 'America/Sao_Paulo';
}

function toNumber(value: unknown): number {
  return value == null ? 0 : Number(value);
}

interface MetricsRow {
  sales_revenue: number;
  rentals_revenue: number;
  month_sales: number;
  active_clients: number;
}

interface RevenueRow {
  date: string;
  rentals: number;
  sales: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private metricsCache: {
    value: DashboardMetricsEntity;
    expiresAt: number;
  } | null = null;

  async getMetrics(): Promise<DashboardMetricsEntity> {
    if (this.metricsCache && this.metricsCache.expiresAt > Date.now()) {
      return this.metricsCache.value;
    }

    const tz = appTimeZone();

    // "Início do mês" e o filtro por data são resolvidos no fuso da aplicação
    // (docs/dashboard-metrics.md > Performance / Fuso). O createdAt é gravado
    // como UTC ingênuo, então: interpreta como UTC e converte para o tz.
    const [activeRentals, rows] = await Promise.all([
      this.prisma.rental.count({ where: { status: RentalStatus.ACTIVE } }),
      this.prisma.$queryRaw<MetricsRow[]>`
        WITH month_start AS (
          SELECT date_trunc('month', (now() AT TIME ZONE ${tz})) AS ts
        )
        SELECT
          COALESCE((
            SELECT SUM("total") FROM "sales", month_start
            WHERE ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= month_start.ts
          ), 0)::float8 AS sales_revenue,
          COALESCE((
            SELECT SUM("total") FROM "rentals", month_start
            WHERE ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= month_start.ts
          ), 0)::float8 AS rentals_revenue,
          (
            SELECT COUNT(*) FROM "sales", month_start
            WHERE ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= month_start.ts
          )::int AS month_sales,
          (
            SELECT COUNT(DISTINCT client_id) FROM (
              SELECT "clientId" AS client_id FROM "rentals" WHERE "status" = 'ACTIVE'
              UNION
              SELECT s."clientId" FROM "sales" s, month_start
              WHERE (s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= month_start.ts
            ) AS active
          )::int AS active_clients
      `,
    ]);

    const row = rows[0];
    const value: DashboardMetricsEntity = {
      monthRevenue: toNumber(row.sales_revenue) + toNumber(row.rentals_revenue),
      activeRentals,
      monthSales: toNumber(row.month_sales),
      activeClients: toNumber(row.active_clients),
    };

    this.metricsCache = { value, expiresAt: Date.now() + METRICS_CACHE_TTL_MS };
    return value;
  }

  async getRevenue(days: number): Promise<RevenuePointEntity[]> {
    const tz = appTimeZone();

    // Um ponto por dia no fuso da aplicação, mesmo sem movimentação (zero).
    const rows = await this.prisma.$queryRaw<RevenueRow[]>`
      SELECT
        to_char(day, 'YYYY-MM-DD') AS date,
        COALESCE(r.total, 0)::float8 AS rentals,
        COALESCE(s.total, 0)::float8 AS sales
      FROM generate_series(
        date_trunc('day', (now() AT TIME ZONE ${tz})) - make_interval(days => ${days - 1}::int),
        date_trunc('day', (now() AT TIME ZONE ${tz})),
        interval '1 day'
      ) AS day
      LEFT JOIN (
        SELECT
          date_trunc('day', ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})) AS day,
          SUM("total") AS total
        FROM "rentals"
        WHERE ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})
          >= date_trunc('day', (now() AT TIME ZONE ${tz})) - make_interval(days => ${days - 1}::int)
        GROUP BY 1
      ) AS r USING (day)
      LEFT JOIN (
        SELECT
          date_trunc('day', ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})) AS day,
          SUM("total") AS total
        FROM "sales"
        WHERE ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz})
          >= date_trunc('day', (now() AT TIME ZONE ${tz})) - make_interval(days => ${days - 1}::int)
        GROUP BY 1
      ) AS s USING (day)
      ORDER BY day
    `;

    return rows.map((row) => {
      const rentals = toNumber(row.rentals);
      const sales = toNumber(row.sales);
      return { date: row.date, rentals, sales, total: rentals + sales };
    });
  }

  async getRecentMovements(): Promise<RecentMovementEntity[]> {
    const [sales, rentals] = await Promise.all([
      this.prisma.sale.findMany({
        orderBy: { createdAt: 'desc' },
        take: RECENT_MOVEMENTS_LIMIT,
        select: {
          id: true,
          total: true,
          createdAt: true,
          client: { select: { name: true } },
        },
      }),
      this.prisma.rental.findMany({
        orderBy: { createdAt: 'desc' },
        take: RECENT_MOVEMENTS_LIMIT,
        select: {
          id: true,
          total: true,
          createdAt: true,
          status: true,
          expectedReturnDate: true,
          client: { select: { name: true } },
        },
      }),
    ]);

    const movements: RecentMovementEntity[] = [
      ...sales.map((sale) => ({
        id: sale.id,
        type: 'SALE' as const,
        client: sale.client.name,
        total: toNumber(sale.total),
        date: sale.createdAt,
        status: 'CONCLUDED' as const,
      })),
      ...rentals.map((rental) => ({
        id: rental.id,
        type: 'RENTAL' as const,
        client: rental.client.name,
        total: toNumber(rental.total),
        date: rental.createdAt,
        status: computeRentalStatus(rental),
      })),
    ];

    return movements
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, RECENT_MOVEMENTS_LIMIT);
  }

  async getUpcomingReturns(): Promise<UpcomingReturnEntity[]> {
    const rentals = await this.prisma.rental.findMany({
      where: { returnedAt: null },
      orderBy: { expectedReturnDate: 'asc' },
      take: UPCOMING_RETURNS_LIMIT,
      select: {
        id: true,
        status: true,
        expectedReturnDate: true,
        client: { select: { name: true } },
      },
    });

    const now = Date.now();
    return rentals.map((rental) => ({
      id: rental.id,
      client: rental.client.name,
      expectedReturnDate: rental.expectedReturnDate,
      status: computeRentalStatus(rental),
      daysOverdue: Math.max(
        0,
        Math.ceil((now - rental.expectedReturnDate.getTime()) / DAY_IN_MS),
      ),
    }));
  }
}
