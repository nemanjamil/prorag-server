import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service.js';

@Module({
  providers: [GenerationService],
  exports: [GenerationService],
})
export class GenerationModule {}
