import { IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ChunkStrategy } from '../../common/enums/chunk-strategy.enum.js';

export class UploadDocumentDto {
  @ApiPropertyOptional({ enum: ChunkStrategy, default: ChunkStrategy.RECURSIVE })
  @IsOptional()
  @IsEnum(ChunkStrategy)
  chunkStrategy?: ChunkStrategy;

  @ApiPropertyOptional({ default: 512 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(4000)
  chunkSize?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  chunkOverlap?: number;
}
