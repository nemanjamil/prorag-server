import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PromptTemplatesService } from './prompt-templates.service.js';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto.js';
import { UpdatePromptTemplateDto } from './dto/update-prompt-template.dto.js';

@ApiTags('prompt-templates')
@Controller('prompt-templates')
export class PromptTemplatesController {
  constructor(private readonly service: PromptTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all prompt templates' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a prompt template' })
  create(@Body() dto: CreatePromptTemplateDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a prompt template by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a prompt template' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromptTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a prompt template (not default)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
