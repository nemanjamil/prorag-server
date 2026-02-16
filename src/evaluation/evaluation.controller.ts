import { Controller, Post, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service.js';

@ApiTags('evaluation')
@Controller('evaluation')
export class EvaluationController {
  constructor(private evaluationService: EvaluationService) {}

  @Post(':id')
  @ApiOperation({ summary: 'Evaluate an existing query log using LLM-as-judge' })
  async evaluate(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationService.evaluateQueryLog(id);
  }

  @Get()
  @ApiOperation({ summary: 'List evaluated query logs with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listEvaluated(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.evaluationService.listEvaluatedLogs(p, l);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get evaluation detail for a query log' })
  async getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationService.getEvaluationDetail(id);
  }
}
