import { Controller, Post, Get, Body, Param, Query, Res, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { QueryService } from './query.service.js';
import { QueryRequestDto } from './dto/query-request.dto.js';

@ApiTags('query')
@Controller('query')
export class QueryController {
  constructor(private queryService: QueryService) {}

  @Post()
  @ApiOperation({
    summary: 'Execute RAG query pipeline',
    description:
      'Streams results via SSE: metadata event → token events → done event. ' +
      'Set Content-Type to text/event-stream on the response.',
  })
  async query(
    @Body() dto: QueryRequestDto,
    @Res() res: any,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await this.queryService.executeQuery(dto, {
      emit: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    });

    res.write('data: [DONE]\n\n');
    res.end();
  }

  @Get('logs')
  @ApiOperation({ summary: 'List query logs with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.queryService.listQueryLogs(p, l);
  }

  @Get('logs/:id')
  @ApiOperation({ summary: 'Get a single query log by ID' })
  async getLog(@Param('id', ParseIntPipe) id: number) {
    return this.queryService.getQueryLog(id);
  }
}
