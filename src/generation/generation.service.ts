import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface GenerateResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export interface StreamUsage {
  promptTokens: number;
  completionTokens: number;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(private config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('openai.apiKey'),
    });
    this.model = this.config.get<string>('openai.llmModel') || 'gpt-4o';
    this.maxTokens = this.config.get<number>('limits.llmMaxTokens') || 4096;
  }

  async generate(
    systemPrompt: string,
    userMessage: string,
    temperature: number,
  ): Promise<GenerateResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_completion_tokens: this.maxTokens,
      stream: false,
    });

    const choice = response.choices[0];
    return {
      text: choice.message.content || '',
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  async *generateStream(
    systemPrompt: string,
    userMessage: string,
    temperature: number,
  ): AsyncGenerator<string, StreamUsage> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_completion_tokens: this.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of stream) {
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }

      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }

    return { promptTokens, completionTokens };
  }
}
