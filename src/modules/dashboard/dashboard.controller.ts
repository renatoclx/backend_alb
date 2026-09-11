import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RevenueQueryDto } from './dto/revenue-query.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  metrics() {
    return this.dashboardService.getMetrics();
  }

  @Get('revenue')
  revenue(@Query() query: RevenueQueryDto) {
    return this.dashboardService.getRevenue(query.days);
  }

  @Get('recent-movements')
  recentMovements() {
    return this.dashboardService.getRecentMovements();
  }

  @Get('upcoming-returns')
  upcomingReturns() {
    return this.dashboardService.getUpcomingReturns();
  }
}
