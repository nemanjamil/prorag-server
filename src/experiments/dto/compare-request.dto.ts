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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SearchMode } from '../../common/enums/search-mode.enum.js';
import { QueryStrategy } from '../../common/enums/query-strategy.enum.js';

export class ConfigVariantDto {
  @ApiPropertyOptional({ enum: SearchMode })
  @IsOptional()
  @IsEnum(SearchMode)
  searchMode?: SearchMode;

  @ApiPropertyOptional({ enum: QueryStrategy })
  @IsOptional()
  @IsEnum(QueryStrategy)
  queryStrategy?: QueryStrategy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rerankerEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  temperature?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  retrievalTopK?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  rerankerTopN?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  documentIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  promptTemplateId?: number;
}

export class CompareRequestDto {
  @ApiProperty({ description: 'The question to compare across configs' })
  @IsString()
  @IsNotEmpty()
  queryText: string;

  @ApiProperty({ type: ConfigVariantDto })
  @ValidateNested()
  @Type(() => ConfigVariantDto)
  configA: ConfigVariantDto;

  @ApiProperty({ type: ConfigVariantDto })
  @ValidateNested()
  @Type(() => ConfigVariantDto)
  configB: ConfigVariantDto;
}
