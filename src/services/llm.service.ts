import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetailLevel } from '../types/summarization.types.js';
import logger from '../utils/logger.js';
import { redisClient } from '../utils/redisClient.js';
import { config } from '../utils/config.js';

export class LLMService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);
  }

  // Legacy method for backward compatibility
  async summarizeExtractedText(extractedText: string, detailLevel: DetailLevel, hashKey: string): Promise<{ summary: string }> {
    const cacheKey = `llm:${hashKey}:${detailLevel}`;
    const cachedSummary = await redisClient.get(cacheKey);
    if (cachedSummary) {
      logger.info(`cache hit for ${cacheKey}`);
      return { summary: cachedSummary };
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
    await redisClient.set(cacheKey, summary, 3600);
    logger.info(`generated summary for detail level ${detailLevel}: ${summary.length} characters`);
    return { summary: summary };
  }
}