import { Injectable } from '@nestjs/common';
import { QueryService } from '../query/query.service.js';
import { QueryRequestDto } from '../query/dto/query-request.dto.js';
import { CompareRequestDto, ConfigVariantDto } from './dto/compare-request.dto.js';

@Injectable()
export class ExperimentsService {
  constructor(private queryService: QueryService) {}

  async compare(dto: CompareRequestDto) {
    const dtoA = this.buildQueryRequest(dto.queryText, dto.configA);
    const dtoB = this.buildQueryRequest(dto.queryText, dto.configB);

    const [resultA, resultB] = await Promise.all([
      this.queryService.executeAndReturn(dtoA),
      this.queryService.executeAndReturn(dtoB),
    ]);

    const comparison = this.computeComparison(resultA, resultB);

    return {
      queryText: dto.queryText,
      resultA,
      resultB,
      comparison,
    };
  }

  private buildQueryRequest(
    queryText: string,
    config: ConfigVariantDto,
  ): QueryRequestDto {
    const req = new QueryRequestDto();
    req.queryText = queryText;
    if (config.searchMode !== undefined) req.searchMode = config.searchMode;
    if (config.queryStrategy !== undefined) req.queryStrategy = config.queryStrategy;
    if (config.rerankerEnabled !== undefined) req.rerankerEnabled = config.rerankerEnabled;
    if (config.temperature !== undefined) req.temperature = config.temperature;
    if (config.retrievalTopK !== undefined) req.retrievalTopK = config.retrievalTopK;
    if (config.rerankerTopN !== undefined) req.rerankerTopN = config.rerankerTopN;
    if (config.documentIds !== undefined) req.documentIds = config.documentIds;
    if (config.promptTemplateId !== undefined) req.promptTemplateId = config.promptTemplateId;
    return req;
  }

  private computeComparison(resultA: any, resultB: any) {
    const timingDeltaMs = (resultA.totalMs ?? 0) - (resultB.totalMs ?? 0);
    const costDeltaUsd =
      Number(resultA.estimatedCostUsd) - Number(resultB.estimatedCostUsd);

    // Chunk overlap: intersection of documentId:chunkIndex keys
    const chunksA: Set<string> = new Set();
    const chunksB: Set<string> = new Set();

    if (Array.isArray(resultA.retrievedChunks)) {
      for (const c of resultA.retrievedChunks) {
        chunksA.add(`${c.documentId}:${c.chunkIndex}`);
      }
    }
    if (Array.isArray(resultB.retrievedChunks)) {
      for (const c of resultB.retrievedChunks) {
        chunksB.add(`${c.documentId}:${c.chunkIndex}`);
      }
    }

    let chunkOverlapCount = 0;
    for (const key of chunksA) {
      if (chunksB.has(key)) chunkOverlapCount++;
    }

    return {
      timingDeltaMs,
      costDeltaUsd: Number(costDeltaUsd.toFixed(6)),
      chunkOverlapCount,
      chunksACount: chunksA.size,
      chunksBCount: chunksB.size,
    };
  }
}
