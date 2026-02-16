import { IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ChunkStrategy } from '../../common/enums/chunk-strategy.enum.js';

export class PreviewChunksDto {
  @ApiProperty({ enum: ChunkStrategy })
  @IsEnum(ChunkStrategy)
  strategy: ChunkStrategy;

  @ApiProperty({ minimum: 100, maximum: 4000 })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(4000)
  chunkSize: number;

  @ApiProperty({ minimum: 0, maximum: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  chunkOverlap: number;
}
