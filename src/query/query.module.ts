import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryLog } from '../database/entities/query-log.entity.js';
import { PromptTemplate } from '../database/entities/prompt-template.entity.js';
import { EmbeddingModule } from '../embedding/embedding.module.js';
import { QdrantModule } from '../qdrant/qdrant.module.js';
import { Bm25Module } from '../bm25/bm25.module.js';
import { RerankerModule } from '../reranker/reranker.module.js';
import { GenerationModule } from '../generation/generation.module.js';
import { QueryController } from './query.controller.js';
import { AnalyticsController } from './analytics.controller.js';
import { QueryService } from './query.service.js';
import { QueryTransformationService } from './query-transformation.service.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([QueryLog, PromptTemplate]),
    EmbeddingModule,
    QdrantModule,
    Bm25Module,
    RerankerModule,
    GenerationModule,
  ],
  controllers: [QueryController, AnalyticsController],
  providers: [QueryService, QueryTransformationService, AnalyticsService],
  exports: [QueryService],
})
export class QueryModule {}
