import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetailLevel } from '../types/summarization.types.js';
import logger from '../utils/logger.js';
import { redisClient, RedisClient } from '../utils/redisClient.js';
import { config } from '../utils/config.js';
import { Types } from '../utils/validation.js';

export class LLMService {
  private redisClient: RedisClient;
  private genAI: GoogleGenerativeAI

  constructor() {
    this.redisClient = redisClient;
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);
  }

  // async summarizeText(text: string, detailLevel: DetailLevel): Promise<string> {
  //   const input: MCPLLMInput = { text, detailLevel };
  //   const output = await this.client.call<MCPLLMInput, MCPLLMOutput>('summarizeText', input);
  //   logger.info(`summarized text for ${detailLevel}`);
  //   return output.summary;
  // }

  async summarizeExtractedText(extractedText: string, detailLevel: DetailLevel, hashKey: string, type: string): Promise<string > {

    const cacheKey = `llm:${hashKey}:${detailLevel}`;
    const cachedSummary = await this.redisClient.get(cacheKey);
    if (cachedSummary) {
      logger.info(`cache hit for ${cacheKey}`);
      return cachedSummary;
    }

    const maxTokens = {
      [DetailLevel.SHORT]: 100,
      [DetailLevel.MEDIUM]: 250,
      [DetailLevel.DETAILED]: 500,
    }[detailLevel];

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Summarize the following text in ${detailLevel} detail, max ${maxTokens} words, focusing on this text:\n${extractedText}`;
    const result = await model.generateContent(prompt);

    const summary = result.response.text();
    if (type !== Types.TEXT) {
      await this.redisClient.set(cacheKey, summary, 3600);  // Cache for 1 hour
    }
    logger.info(`generated summary for detail level ${detailLevel}: ${summary.length} characters`);
    return summary;
  }
}