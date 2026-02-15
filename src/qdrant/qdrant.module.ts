import { Module } from '@nestjs/common';
import { QdrantService } from './qdrant.service.js';

@Module({
  providers: [QdrantService],
  exports: [QdrantService],
})
export class QdrantModule {}
