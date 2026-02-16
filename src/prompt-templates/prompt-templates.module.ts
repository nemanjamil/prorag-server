import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptTemplate } from '../database/entities/prompt-template.entity.js';
import { PromptTemplatesController } from './prompt-templates.controller.js';
import { PromptTemplatesService } from './prompt-templates.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PromptTemplate])],
  controllers: [PromptTemplatesController],
  providers: [PromptTemplatesService],
  exports: [PromptTemplatesService],
})
export class PromptTemplatesModule {}
