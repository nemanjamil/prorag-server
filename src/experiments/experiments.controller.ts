import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExperimentsService } from './experiments.service.js';
import { CompareRequestDto } from './dto/compare-request.dto.js';

@ApiTags('experiments')
@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly service: ExperimentsService) {}

  @Post('compare')
  @ApiOperation({ summary: 'Run same query with two configs, return both results' })
  compare(@Body() dto: CompareRequestDto) {
    return this.service.compare(dto);
  }
}
