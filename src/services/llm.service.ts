import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetailLevel } from '../types/summarization.types.js';
import logger from '../utils/logger.js';
import { redisClient, RedisClient } from '../utils/redisClient.js';
import { config } from '../utils/config.js';
import { Types } from '../utils/validation.js';

interface ModelConfig {
  contextWindow: number; // Total context window in tokens
  chunkSize: number; // Size per chunk (leaving buffer for response)
  safetyBuffer: number; // Buffer for model response and prompt overhead
}

interface ChunkSummaryResult {
  chunkIndex: number;
  summary: string;
}

export class LLMService {
  private redisClient: RedisClient;
  private genAI: GoogleGenerativeAI;
  
  // Model configurations - easily extendable for different models
  private modelConfigs: Record<string, ModelConfig> = {
    'gemini-1.5-flash': {
      contextWindow: 1000000, // 1M tokens
      chunkSize: 999000, // 999k tokens per chunk
      safetyBuffer: 50000 // 50k tokens buffer for response and prompt
    },
    'gemini-1.5-pro': {
      contextWindow: 2000000, // 2M tokens
      chunkSize: 1990000,
      safetyBuffer: 100000
    }
    // Add more models as needed
  };

  private currentModel = 'gemini-1.5-flash';

  constructor() {
    this.redisClient = redisClient;
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);
  }

    async summarizeExtractedText(
    extractedText: string, 
    detailLevel: DetailLevel, 
    hashKey: string, 
    type: string
  ): Promise<string> {
    // ADD THIS DEBUG LOG HERE (at the beginning of method)
    logger.info(`=== LLM SUMMARIZATION DEBUG ===`);
    logger.info(`Input text length: ${extractedText.length} characters`);
    logger.info(`Detail level: ${detailLevel}`);
    logger.info(`Hash key: ${hashKey}`);
    logger.info(`Type: ${type}`);
    const config = this.modelConfigs[this.currentModel];
    const textTokens = this.estimateTokenCount(extractedText);

    logger.info(`Estimated token count: ${textTokens}`);

    // Automatically use chunking for large texts
    if (textTokens > config.chunkSize) {
      logger.info(`Text size (${textTokens} tokens) exceeds chunk limit, using chunked summarization`);
      return this.summarizeTextWithChunking(extractedText, detailLevel, hashKey, type);
    }

    // Original implementation for smaller texts
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

    const model = this.genAI.getGenerativeModel({ model: this.currentModel });
    const prompt = `Summarize the following text in ${detailLevel} detail, focusing on this text:\n${extractedText}`;
    const result = await model.generateContent(prompt);

    const summary = result.response.text();
    if (type !== Types.TEXT) {
      await this.redisClient.set(cacheKey, summary, 3600);  // Cache for 1 hour
    }
    logger.info(`generated summary for detail level ${detailLevel}: ${summary.length} characters`);
    return summary;
  }

    async summarizeTextWithChunking(
    text: string,
    detailLevel: DetailLevel,
    hashKey: string,
    type: string
  ): Promise<string> {
    try {
      // Check cache first
      const cacheKey = `llm:${hashKey}:${detailLevel}:chunked`;
      const cachedSummary = await this.redisClient.get(cacheKey);
      if (cachedSummary) {
        logger.info(`Cache hit for chunked summary: ${cacheKey}`);
        return cachedSummary;
      }

      const config = this.modelConfigs[this.currentModel];
      const textTokens = this.estimateTokenCount(text);
      
      logger.info(`Processing text with ${textTokens} estimated tokens using ${this.currentModel}`);

      // If text fits in single request, use original method
      if (textTokens <= config.chunkSize) {
        logger.info('Text fits in single chunk, using direct summarization');
        return this.summarizeExtractedText(text, detailLevel, hashKey, type);
      }

      // Split text into chunks
      const chunks = this.chunkText(text, config.chunkSize);
      logger.info(`Text split into ${chunks.length} chunks for processing`);

      // Calculate optimal summary size per chunk
      const chunkSummarySize = this.calculateChunkSummarySize(chunks.length, detailLevel);
      logger.info(`Target summary size per chunk: ${chunkSummarySize} words`);

      // Process chunks asynchronously
      const chunkPromises = chunks.map((chunk, index) =>
        this.summarizeChunk(chunk, index, chunkSummarySize)
      );

      const chunkResults = await Promise.all(chunkPromises);
      
      // Sort results by chunk index to maintain order
      chunkResults.sort((a, b) => a.chunkIndex - b.chunkIndex);
      const orderedSummaries = chunkResults.map(result => result.summary);

      logger.info(`All ${chunks.length} chunks processed, creating final summary`);

      // Create final summary
      const finalSummary = await this.createFinalSummary(
        orderedSummaries, 
        detailLevel,
        type === Types.FILE ? `document: ${hashKey}` : `${type} content`
      );

      // Cache the result (only for non-text inputs to avoid caching user input directly)
      if (type !== Types.TEXT) {
        await this.redisClient.set(cacheKey, finalSummary, 3600);
      }

      logger.info(`Final chunked summary generated: ${finalSummary.length} characters from ${chunks.length} chunks`);
      return finalSummary;

    } catch (error) {
      logger.error('Error in chunked summarization:', error);
      throw error;
    }
  }


  // Estimates token count (rough approximation: 1 token ≈ 4 characters)
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }


  // Splits text into chunks based on token limits
  private chunkText(text: string, maxChunkTokens: number): string[] {
    const estimatedTokens = this.estimateTokenCount(text);
    
    if (estimatedTokens <= maxChunkTokens) {
      return [text];
    }

    const chunks: string[] = [];
    const maxCharsPerChunk = maxChunkTokens * 4; // Rough conversion
    
    // Split by sentences first to maintain coherence
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length > maxCharsPerChunk && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk = potentialChunk;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Fallback: if sentences are too long, split by character count
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length > maxCharsPerChunk) {
        const subChunks = this.splitByCharCount(chunk, maxCharsPerChunk);
        finalChunks.push(...subChunks);
      } else {
        finalChunks.push(chunk);
      }
    }
    
    return finalChunks;
  }

  
  // Split text by character count as fallback
  private splitByCharCount(text: string, maxChars: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) {
      chunks.push(text.slice(i, i + maxChars));
    }
    return chunks;
  }

  
  // Calculate optimal summary size per chunk based on total chunks
  private calculateChunkSummarySize(totalChunks: number, detailLevel: DetailLevel): number {
    const config = this.modelConfigs[this.currentModel];
    const availableTokens = config.contextWindow - config.safetyBuffer;
    
    // Reserve tokens for final summary prompt and response
    const finalPromptTokens = 1000;
    const finalResponseTokens = {
      [DetailLevel.SHORT]: 150,
      [DetailLevel.MEDIUM]: 350,
      [DetailLevel.DETAILED]: 700
    }[detailLevel];
    
    const availableForChunkSummaries = availableTokens - finalPromptTokens - finalResponseTokens;
    const tokensPerChunkSummary = Math.floor(availableForChunkSummaries / totalChunks);
    
    // Ensure minimum viable summary size (at least 50 words)
    return Math.max(tokensPerChunkSummary, 50);
  }

  
  //  Summarize a single chunk
  private async summarizeChunk(
    chunk: string, 
    chunkIndex: number, 
    targetSummarySize: number
  ): Promise<ChunkSummaryResult> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.currentModel });
      const prompt = `Summarize the following text in approximately ${targetSummarySize} words. 
        Focus on key points and maintain context for later combination with other summaries.
        
        Text to summarize:
        ${chunk}`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text();
      
      logger.info(`Chunk ${chunkIndex + 1} summarized: ${summary.length} characters`);
      
      return {
        chunkIndex,
        summary
      };
    } catch (error) {
      logger.error(`Error summarizing chunk ${chunkIndex + 1}:`, error);
      throw error;
    }
  }

  
  // Create final summary from chunk summaries
  private async createFinalSummary(
    chunkSummaries: string[], 
    detailLevel: DetailLevel,
    originalContext: string
  ): Promise<string> {
    const combinedSummaries = chunkSummaries.join('\n\n');
    
    const maxTokens = {
      [DetailLevel.SHORT]: 100,
      [DetailLevel.MEDIUM]: 250,
      [DetailLevel.DETAILED]: 500,
    }[detailLevel];

    const model = this.genAI.getGenerativeModel({ model: this.currentModel });
    const prompt = `Create a comprehensive ${detailLevel} summary (max ${maxTokens} words) from the following chunk summaries. 
      Ensure coherence and maintain the most important information from the original ${originalContext}.
      
      Chunk summaries to combine:
      ${combinedSummaries}`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  // Update model configuration (for future model changes)
  setModel(modelName: string, config?: ModelConfig): void {
    if (config) {
      this.modelConfigs[modelName] = config;
    }
    
    if (this.modelConfigs[modelName]) {
      this.currentModel = modelName;
      logger.info(`Switched to model: ${modelName}`);
    } else {
      logger.error(`Model configuration not found: ${modelName}`);
      throw new Error(`Unsupported model: ${modelName}`);
    }
  }

  
  // Get current model info
  getCurrentModelInfo(): { model: string; config: ModelConfig } {
    return {
      model: this.currentModel,
      config: this.modelConfigs[this.currentModel]
    };
  }
}