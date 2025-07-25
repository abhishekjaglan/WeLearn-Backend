import { AWSAuth } from '../utils/awsAuth.js';
import { GetDocumentTextDetectionCommand, StartDocumentTextDetectionCommand, TextractClient } from '@aws-sdk/client-textract';
import { Block, Relationship } from '../types/types.js';
import { RedisClient } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import { config } from '../utils/config.js';
import { AppError } from '../types/errors.js';

export class TextractService {
  private textractClient: TextractClient;
  private redisClient: RedisClient;

  constructor() {
    this.textractClient = AWSAuth.getTextractClient();
    this.redisClient = new RedisClient();
  }

  async textract(hashKey: string): Promise<{ Blocks: any[] }> {
    try {
      const cachedKey = `textract:${hashKey}`;
      const extractedCache = await this.redisClient.get(cachedKey);
      if (extractedCache) {
        logger.info(`Extracted text already exists in Redis for: ${hashKey}`);
        return { Blocks: [] };
      }

      const detectDocumentTextCommand = new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: config.AWS_S3_BUCKET!,
            Name: hashKey,
          },
        },
      });

      const DetectionResponse = await this.textractClient.send(detectDocumentTextCommand);
      const jobId = DetectionResponse.JobId;
      if (!jobId) {
        logger.error(`No JobId returned for: ${hashKey}`);
        throw new AppError('No JobId returned from Textract', 500);
      }

      const response = await this.getTextractJobStatus(jobId);

      logger.info(`Document text detected for: ${hashKey}`);
      if (response.Blocks) {
        logger.info(`Blocks detected: ${response.Blocks.length}`);
      } else {
        logger.error(`No blocks detected for: ${hashKey}`);
      }
      return { Blocks: response.Blocks || [] };
    } catch (error) {
      logger.error(`Error extracting text from document: ${hashKey}`, error);
      throw new AppError('Error extracting text from document', 500);
    }
  }

  async stitchTextFromBlocks(blocks: any, hashKey: string): Promise<string> {
    const extractedCache = await this.redisClient.get(`textract:${hashKey}`);
    if (extractedCache) {
      logger.info(`Extracted and stitched text already exists in Redis for: ${hashKey}`);
      return extractedCache;
    }

    if (!blocks || blocks.length === 0) {
      logger.error(`No blocks found for ${hashKey}`);
      return 'No Blocks Found';
    }

    const lineBlocks: any[] = [];
    const childWordIds = new Set();

    blocks.forEach((block: Block) => {
      if (block.BlockType === 'LINE') {
        lineBlocks.push(block);
        if (block.Relationships) {
          block.Relationships.forEach((rel: Relationship) => {
            if (rel.Type === 'CHILD' && rel.Ids) {
              rel.Ids.forEach((id: string) => childWordIds.add(id));
            }
          });
        }
      }
    });

    const standaloneWordBlocks = blocks.filter((block: Block) =>
      block.BlockType === 'WORD' && !childWordIds.has(block.Id)
    );

    const lineText = lineBlocks
      .map(block => block.Text || '')
      .join('\n');

    const wordText = standaloneWordBlocks
      .map((block: Block) => block.Text || '')
      .join(' ');

    const text = lineText + (lineText && wordText ? '\n' : '') + wordText;
    logger.info(`Stitched text (50 chars): ${text.slice(0, 50)}...`);

    const cacheKey = `textract:${hashKey}`;
    await this.redisClient.set(cacheKey, text, 3600);
    logger.info(`Cached extracted text for ${hashKey} in Redis`);

    return text;
  }

  private async getTextractJobStatus(jobId: string): Promise<any> {
    const getCommand = new GetDocumentTextDetectionCommand({ JobId: jobId });
    let response;
    do {
      response = await this.textractClient.send(getCommand);
      if (response.JobStatus === 'SUCCEEDED') {
        return response;
      } else if (response.JobStatus === 'FAILED') {
        throw new Error('Textract job failed');
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    } while (response.JobStatus === 'IN_PROGRESS');
  }
}
