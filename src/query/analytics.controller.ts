import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get cost and usage analytics' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Lookback window in days (1-365, default 30)' })
  async getAnalytics(@Query('days') daysParam?: string) {
    const parsed = parseInt(daysParam || '30', 10) || 30;
    const days = Math.max(1, Math.min(365, parsed));
    return this.analyticsService.getAnalytics(days);
  }
}
