import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { envValidationSchema } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { EmbeddingModule } from './embedding/embedding.module.js';
import { QdrantModule } from './qdrant/qdrant.module.js';
import { Bm25Module } from './bm25/bm25.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    HealthModule,
    DocumentsModule,
    EmbeddingModule,
    QdrantModule,
    Bm25Module,
  ],
})
export class AppModule {}
