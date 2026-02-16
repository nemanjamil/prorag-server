import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsInt,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SearchMode } from '../../common/enums/search-mode.enum.js';
import { QueryStrategy } from '../../common/enums/query-strategy.enum.js';

export class QueryRequestDto {
  @ApiProperty({ description: 'The question to ask against uploaded documents' })
  @IsString()
  @IsNotEmpty()
  queryText: string;

  @ApiPropertyOptional({ enum: SearchMode, default: 'hybrid' })
  @IsOptional()
  @IsEnum(SearchMode)
  searchMode?: SearchMode;

  @ApiPropertyOptional({ enum: QueryStrategy, default: 'direct' })
  @IsOptional()
  @IsEnum(QueryStrategy)
  queryStrategy?: QueryStrategy;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  rerankerEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 2, default: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  temperature?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  retrievalTopK?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  rerankerTopN?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Filter to specific document IDs. If omitted, searches all documents.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  documentIds?: number[];

  @ApiPropertyOptional({ description: 'ID of the prompt template to use' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  promptTemplateId?: number;
}
