import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChunkStrategy } from '../common/enums/chunk-strategy.enum.js';

export interface Chunk {
  text: string;
  chunkIndex: number;
  pageNumber: number | null;
  startChar: number;
  endChar: number;
}

interface PageText {
  pageNumber: number;
  text: string;
}

@Injectable()
export class ChunkingService {
  private readonly semanticThreshold: number;

  constructor(private config: ConfigService) {
    this.semanticThreshold = this.config.get<number>(
      'SEMANTIC_SIMILARITY_THRESHOLD',
      0.85,
    );
  }

  chunk(
    pages: PageText[],
    strategy: ChunkStrategy,
    chunkSize: number,
    chunkOverlap: number,
  ): Chunk[] {
    const fullText = pages.map((p) => p.text).join('\n');

    switch (strategy) {
      case ChunkStrategy.FIXED:
        return this.fixedSizeChunk(fullText, pages, chunkSize, chunkOverlap);
      case ChunkStrategy.RECURSIVE:
        return this.recursiveChunk(fullText, pages, chunkSize, chunkOverlap);
      case ChunkStrategy.SEMANTIC:
        return this.semanticChunk(fullText, pages, chunkSize);
      default:
        return this.recursiveChunk(fullText, pages, chunkSize, chunkOverlap);
    }
  }

  private fixedSizeChunk(
    text: string,
    pages: PageText[],
    chunkSize: number,
    overlap: number,
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          chunkIndex: chunkIndex++,
          pageNumber: this.findPageNumber(start, pages),
          startChar: start,
          endChar: end,
        });
      }
      start += chunkSize - overlap;
    }

    return chunks;
  }

  private recursiveChunk(
    text: string,
    pages: PageText[],
    chunkSize: number,
    overlap: number,
  ): Chunk[] {
    const separators = ['\n\n', '\n', '. ', ' '];
    const rawChunks = this.recursiveSplit(text, separators, chunkSize);

    const chunks: Chunk[] = [];
    let charOffset = 0;

    for (let i = 0; i < rawChunks.length; i++) {
      const chunkText = rawChunks[i].trim();
      if (chunkText.length === 0) continue;

      const startChar = text.indexOf(chunkText, charOffset);
      const endChar = startChar + chunkText.length;
      charOffset = startChar + 1;

      let finalText = chunkText;
      if (overlap > 0 && i > 0) {
        const prevChunk = rawChunks[i - 1];
        const overlapText = prevChunk.slice(-overlap);
        if (overlapText.length > 0 && !chunkText.startsWith(overlapText)) {
          finalText = overlapText + ' ' + chunkText;
        }
      }

      chunks.push({
        text: finalText,
        chunkIndex: i,
        pageNumber: this.findPageNumber(startChar >= 0 ? startChar : 0, pages),
        startChar: startChar >= 0 ? startChar : 0,
        endChar: endChar >= 0 ? endChar : finalText.length,
      });
    }

    return chunks;
  }

  private recursiveSplit(
    text: string,
    separators: string[],
    chunkSize: number,
  ): string[] {
    if (text.length <= chunkSize) return [text];
    if (separators.length === 0) {
      return [text.slice(0, chunkSize)];
    }

    const separator = separators[0];
    const parts = text.split(separator);

    const chunks: string[] = [];
    let current = '';

    for (const part of parts) {
      const candidate = current ? current + separator + part : part;
      if (candidate.length <= chunkSize) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        if (part.length > chunkSize) {
          const subChunks = this.recursiveSplit(
            part,
            separators.slice(1),
            chunkSize,
          );
          chunks.push(...subChunks);
          current = '';
        } else {
          current = part;
        }
      }
    }
    if (current) chunks.push(current);

    return chunks;
  }

  private semanticChunk(
    text: string,
    pages: PageText[],
    chunkSize: number,
  ): Chunk[] {
    const sentences = this.splitSentences(text);
    if (sentences.length === 0) return [];

    const chunks: Chunk[] = [];
    let currentGroup: string[] = [sentences[0]];
    let chunkIndex = 0;

    for (let i = 1; i < sentences.length; i++) {
      const currentText = currentGroup.join(' ');
      const candidate = currentText + ' ' + sentences[i];

      const similarity = this.jaccardSimilarity(
        sentences[i - 1],
        sentences[i],
      );

      if (similarity >= this.semanticThreshold && candidate.length <= chunkSize * 2) {
        currentGroup.push(sentences[i]);
      } else {
        const chunkText = currentGroup.join(' ').trim();
        if (chunkText.length > 0) {
          const startChar = text.indexOf(currentGroup[0]);
          chunks.push({
            text: chunkText,
            chunkIndex: chunkIndex++,
            pageNumber: this.findPageNumber(
              startChar >= 0 ? startChar : 0,
              pages,
            ),
            startChar: startChar >= 0 ? startChar : 0,
            endChar: (startChar >= 0 ? startChar : 0) + chunkText.length,
          });
        }
        currentGroup = [sentences[i]];
      }
    }

    if (currentGroup.length > 0) {
      const chunkText = currentGroup.join(' ').trim();
      if (chunkText.length > 0) {
        const startChar = text.indexOf(currentGroup[0]);
        chunks.push({
          text: chunkText,
          chunkIndex: chunkIndex++,
          pageNumber: this.findPageNumber(
            startChar >= 0 ? startChar : 0,
            pages,
          ),
          startChar: startChar >= 0 ? startChar : 0,
          endChar: (startChar >= 0 ? startChar : 0) + chunkText.length,
        });
      }
    }

    return chunks;
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private findPageNumber(charOffset: number, pages: PageText[]): number | null {
    let cumulative = 0;
    for (const page of pages) {
      cumulative += page.text.length + 1; // +1 for newline join
      if (charOffset < cumulative) return page.pageNumber;
    }
    return pages.length > 0 ? pages[pages.length - 1].pageNumber : null;
  }
}
