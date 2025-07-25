import { TextractService } from './textract.service.js';
import { ChunkingService } from './chunking.service.js';
import { RedisClient } from '../utils/redisClient.js';
import logger from '../utils/logger.js';

export interface ProcessDocumentResult {
  chunks: string[];
  metadata: {
    totalChunks: number;
    originalTextLength: number;
    averageChunkSize: number;
  };
}

export class DocumentProcessingService {
  private textractService: TextractService;
  private chunkingService: ChunkingService;
  private redisClient: RedisClient;

  constructor() {
    this.textractService = new TextractService();
    this.chunkingService = new ChunkingService();
    this.redisClient = new RedisClient();
  }

  async processDocument(s3Key: string, fileName: string, userId: string): Promise<ProcessDocumentResult> {
    const cacheKey = `document_chunks:${userId}:${s3Key}`;
    
    // Check cache first
    const cachedResult = await this.redisClient.get(cacheKey);
    if (cachedResult) {
      logger.info(`Cache hit for document chunks: ${s3Key}`);
      return JSON.parse(cachedResult);
    }

    // Extract text using Textract
    const extractedText = await this.extractTextFromDocument(s3Key);
    
    // Create intelligent chunks
    const chunks = await this.chunkingService.createChunks(extractedText);
    
    const result: ProcessDocumentResult = {
      chunks,
      metadata: {
        totalChunks: chunks.length,
        originalTextLength: extractedText.length,
        averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length),
      },
    };

    // Cache the result
    await this.redisClient.set(cacheKey, JSON.stringify(result), 3600); // 1 hour cache
    logger.info(`Cached document chunks for: ${s3Key}, total chunks: ${chunks.length}`);

    return result;
  }

  private async extractTextFromDocument(s3Key: string): Promise<string> {
    const extractedBlocks = await this.textractService.textract(s3Key);
    const stitchedText = await this.textractService.stitchTextFromBlocks(extractedBlocks.Blocks, s3Key);
    return stitchedText;
  }
}
