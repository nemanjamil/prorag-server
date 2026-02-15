import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentStatus } from '../../common/enums/document-status.enum.js';
import { ChunkStrategy } from '../../common/enums/chunk-strategy.enum.js';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'original_filename', type: 'varchar', length: 512 })
  originalFilename: string;

  @Column({ name: 'storage_path', type: 'varchar', length: 1024 })
  storagePath: string;

  @Column({ name: 'file_size_bytes', type: 'bigint' })
  fileSizeBytes: number;

  @Column({ name: 'page_count', type: 'int', nullable: true })
  pageCount: number | null;

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount: number;

  @Column({
    name: 'chunk_strategy',
    type: 'enum',
    enum: ChunkStrategy,
  })
  chunkStrategy: ChunkStrategy;

  @Column({ name: 'chunk_size', type: 'int', default: 512 })
  chunkSize: number;

  @Column({ name: 'chunk_overlap', type: 'int', default: 50 })
  chunkOverlap: number;

  @Column({
    name: 'qdrant_collection',
    type: 'varchar',
    length: 255,
    default: 'pdf_documents',
  })
  qdrantCollection: string;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status: DocumentStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
