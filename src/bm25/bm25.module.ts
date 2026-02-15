import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bm25Service } from './bm25.service.js';
import { Document } from '../database/entities/document.entity.js';
import { DocumentsModule } from '../documents/documents.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    forwardRef(() => DocumentsModule),
  ],
  providers: [Bm25Service],
  exports: [Bm25Service],
})
export class Bm25Module {}
