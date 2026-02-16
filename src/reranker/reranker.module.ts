import { Module } from '@nestjs/common';
import { RerankerService } from './reranker.service.js';

@Module({
  providers: [RerankerService],
  exports: [RerankerService],
})
export class RerankerModule {}
