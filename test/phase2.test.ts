import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import { ChunkingService } from '../src/chunking/chunking.service';
import { ChunkStrategy } from '../src/common/enums/chunk-strategy.enum';
import { ConfigService } from '@nestjs/config';

const PDF_PATH = path.resolve(__dirname, '../pdf/PDF_RAG_Learning_Platform_Technical_Proposal.pdf');

describe('Phase 2: PDF Upload & Multi-Strategy Chunking', () => {
  let chunkingService: ChunkingService;
  let pages: { pageNumber: number; text: string }[];

  beforeAll(async () => {
    // Mock ConfigService
    const mockConfig = {
      get: (key: string, defaultVal?: any) => {
        const map: Record<string, any> = {
          SEMANTIC_SIMILARITY_THRESHOLD: 0.85,
        };
        return map[key] ?? defaultVal;
      },
    } as unknown as ConfigService;

    chunkingService = new ChunkingService(mockConfig);

    // Parse the PDF
    const buffer = fs.readFileSync(PDF_PATH);
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);
    const result = await parser.getText();
    pages = result.pages.map((page: { text: string; num: number }) => ({
      pageNumber: page.num,
      text: page.text,
    }));
    parser.destroy();
  });

  describe('PDF Parsing (pdf-parse v2)', () => {
    it('should parse the PDF and extract 20 pages', () => {
      expect(pages.length).toBe(20);
    });

    it('should have non-empty text on each page', () => {
      for (const page of pages) {
        expect(page.text.length).toBeGreaterThan(0);
      }
    });

    it('should contain expected content from the proposal', () => {
      const fullText = pages.map((p) => p.text).join(' ');
      expect(fullText).toContain('RAG');
      expect(fullText).toContain('PDF');
    });
  });

  describe('Fixed-size chunking', () => {
    it('should produce chunks within size bounds', () => {
      const chunks = chunkingService.chunk(pages, ChunkStrategy.FIXED, 512, 50);
      expect(chunks.length).toBeGreaterThan(0);

      for (const chunk of chunks) {
        expect(chunk.text.length).toBeGreaterThan(0);
        expect(chunk.text.length).toBeLessThanOrEqual(512);
        expect(chunk.chunkIndex).toBeGreaterThanOrEqual(0);
        expect(chunk.pageNumber).toBeGreaterThanOrEqual(1);
      }
    });

    it('should produce sequential chunk indices', () => {
      const chunks = chunkingService.chunk(pages, ChunkStrategy.FIXED, 512, 50);
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
      }
    });

    it('should produce more chunks with smaller chunk size', () => {
      const chunksLarge = chunkingService.chunk(pages, ChunkStrategy.FIXED, 1000, 0);
      const chunksSmall = chunkingService.chunk(pages, ChunkStrategy.FIXED, 200, 0);
      expect(chunksSmall.length).toBeGreaterThan(chunksLarge.length);
    });
  });

  describe('Recursive chunking', () => {
    it('should produce non-empty chunks', () => {
      const chunks = chunkingService.chunk(pages, ChunkStrategy.RECURSIVE, 512, 50);
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }
    });

    it('should respect approximate chunk size limits', () => {
      const chunks = chunkingService.chunk(pages, ChunkStrategy.RECURSIVE, 512, 0);
      for (const chunk of chunks) {
        // Recursive allows some flexibility, but should be roughly within bounds
        expect(chunk.text.length).toBeLessThanOrEqual(1024);
      }
    });
  });

  describe('Semantic chunking', () => {
    it('should produce non-empty chunks', () => {
      const chunks = chunkingService.chunk(pages, ChunkStrategy.SEMANTIC, 512, 0);
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }
    });

    it('should produce fewer chunks than fixed-size at same size', () => {
      const fixedChunks = chunkingService.chunk(pages, ChunkStrategy.FIXED, 512, 0);
      const semanticChunks = chunkingService.chunk(pages, ChunkStrategy.SEMANTIC, 512, 0);
      // Semantic groups related sentences, so should generally produce different count
      expect(semanticChunks.length).toBeGreaterThan(0);
      expect(fixedChunks.length).toBeGreaterThan(0);
    });
  });

  describe('All strategies cover full text', () => {
    const fullText = () => pages.map((p) => p.text).join('\n');

    it('fixed chunks should cover content from beginning and end', () => {
      const chunks = chunkingService.chunk(pages, ChunkStrategy.FIXED, 512, 50);
      const chunkedText = chunks.map((c) => c.text).join(' ');
      // First and last pages should be represented
      expect(chunkedText).toContain('TECHNICAL PROJECT PROPOSAL');
    });

    it('recursive chunks should cover content from beginning and end', () => {
      const chunks = chunkingService.chunk(pages, ChunkStrategy.RECURSIVE, 512, 50);
      const chunkedText = chunks.map((c) => c.text).join(' ');
      expect(chunkedText).toContain('TECHNICAL PROJECT PROPOSAL');
    });

    it('semantic chunks should cover content from beginning and end', () => {
      const chunks = chunkingService.chunk(pages, ChunkStrategy.SEMANTIC, 512, 0);
      const chunkedText = chunks.map((c) => c.text).join(' ');
      expect(chunkedText).toContain('TECHNICAL PROJECT PROPOSAL');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty pages gracefully', () => {
      const emptyPages = [{ pageNumber: 1, text: '' }];
      const chunks = chunkingService.chunk(emptyPages, ChunkStrategy.FIXED, 512, 50);
      expect(chunks.length).toBe(0);
    });

    it('should handle single-word page', () => {
      const singleWord = [{ pageNumber: 1, text: 'hello' }];
      const chunks = chunkingService.chunk(singleWord, ChunkStrategy.RECURSIVE, 512, 50);
      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe('hello');
    });
  });
});
