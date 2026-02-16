import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { PromptTemplate } from '../database/entities/prompt-template.entity.js';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto.js';
import { UpdatePromptTemplateDto } from './dto/update-prompt-template.dto.js';

@Injectable()
export class PromptTemplatesService {
  constructor(
    @InjectRepository(PromptTemplate)
    private repo: Repository<PromptTemplate>,
  ) {}

  async create(dto: CreatePromptTemplateDto): Promise<PromptTemplate> {
    if (dto.isDefault) {
      await this.repo.update({}, { isDefault: false });
    }
    const template = this.repo.create(dto);
    return this.repo.save(template);
  }

  async findAll(): Promise<PromptTemplate[]> {
    return this.repo.find({
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<PromptTemplate> {
    const template = await this.repo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Prompt template #${id} not found`);
    }
    return template;
  }

  async update(
    id: number,
    dto: UpdatePromptTemplateDto,
  ): Promise<PromptTemplate> {
    const template = await this.findOne(id);
    if (dto.isDefault) {
      await this.repo.update({ id: Not(id) }, { isDefault: false });
    }
    Object.assign(template, dto);
    return this.repo.save(template);
  }

  async remove(id: number): Promise<void> {
    const template = await this.findOne(id);
    if (template.isDefault) {
      throw new ConflictException('Cannot delete the default prompt template');
    }
    await this.repo.remove(template);
  }
}
