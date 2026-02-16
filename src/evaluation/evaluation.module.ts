import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryLog } from '../database/entities/query-log.entity.js';
import { EvaluationService } from './evaluation.service.js';
import { EvaluationController } from './evaluation.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([QueryLog])],
  controllers: [EvaluationController],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}
