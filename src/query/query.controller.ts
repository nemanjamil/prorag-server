import { Controller, Post, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
}
