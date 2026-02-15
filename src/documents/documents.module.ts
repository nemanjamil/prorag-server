import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { Document } from '../database/entities/document.entity.js';
import { ChunkingModule } from '../chunking/chunking.module.js';
import { EmbeddingModule } from '../embedding/embedding.module.js';
import { QdrantModule } from '../qdrant/qdrant.module.js';
import { Bm25Module } from '../bm25/bm25.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    ChunkingModule,
    EmbeddingModule,
    QdrantModule,
    forwardRef(() => Bm25Module),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
