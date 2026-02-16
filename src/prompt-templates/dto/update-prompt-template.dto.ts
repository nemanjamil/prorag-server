import { PartialType } from '@nestjs/swagger';
import { CreatePromptTemplateDto } from './create-prompt-template.dto.js';

export class UpdatePromptTemplateDto extends PartialType(CreatePromptTemplateDto) {}
