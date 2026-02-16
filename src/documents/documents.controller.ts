import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DocumentsService } from './documents.service.js';
import { UploadDocumentDto } from './dto/upload-document.dto.js';
import { PreviewChunksDto } from './dto/preview-chunks.dto.js';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a PDF document for processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        chunkStrategy: { type: 'string', enum: ['fixed', 'recursive', 'semantic'] },
        chunkSize: { type: 'number' },
        chunkOverlap: { type: 'number' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(new Error('Only PDF files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.upload(
      file,
      dto.chunkStrategy,
      dto.chunkSize,
      dto.chunkOverlap,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all documents' })
  findAll() {
    return this.documentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document details' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/chunks')
  @ApiOperation({ summary: 'Get chunks for a document' })
  getChunks(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.getChunks(id);
  }

  @Post(':id/preview-chunks')
  @ApiOperation({ summary: 'Preview chunks with different parameters (read-only)' })
  previewChunks(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PreviewChunksDto,
  ) {
    return this.documentsService.previewChunks(
      id,
      dto.strategy,
      dto.chunkSize,
      dto.chunkOverlap,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.remove(id);
  }
}
