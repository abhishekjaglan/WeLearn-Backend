
import { AWSAuth } from '../utils/awsAuth.js';
import { GetDocumentTextDetectionCommand, StartDocumentTextDetectionCommand, TextractClient } from '@aws-sdk/client-textract';
import { Block, Relationship } from '@aws-sdk/client-textract/dist-types/models/models_0.js';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { redisClient, RedisClient } from '../utils/redisClient.js';
import logger from '../utils/logger.js';
import { config } from '../utils/config.js';
import { AppError } from '../types/error.type.js';
export class TextractService {
  private textractClient: TextractClient;
  private s3Client: S3Client;
  private redisClient: RedisClient;

  constructor() {
    this.textractClient = AWSAuth.getTextractClient();
    this.s3Client = AWSAuth.getS3Client();
    this.redisClient = redisClient;
  }

  async textract(hashKey: string): Promise<{ Blocks: any[] }> {
    // Check if the document already exists in Redis
    try {
      console.log('Inside TextractService');
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
      logger.error(`Error checking Redis for document: ${hashKey}`, error);
      throw new AppError('Error extracting text from document', 500);
    }
  }

  async stitchTextFromBlocks(blocks: any, hashKey: string): Promise<string> {
    // Check if the document already exists in Redis
    const extractedCache = await this.redisClient.get(hashKey);
    if (extractedCache) {
      logger.info(`Extracted and stitched text already exists in Redis for: ${hashKey}`);
      return extractedCache;
    }

    if (!blocks || blocks.length === 0) {
      logger.error(`No blocks found for ${hashKey}`);
      return 'No Blocks Found';
    }
    // Step 1: Collect LINE blocks and their child WORD block IDs
    const lineBlocks: any[] = [];
    const childWordIds = new Set();

    blocks.forEach((block: Block) => {
      if (block.BlockType === 'LINE') {
        lineBlocks.push(block);
        // Check Relationships for child WORD blocks
        if (block.Relationships) {
          block.Relationships.forEach((rel: Relationship) => {
            if (rel.Type === 'CHILD' && rel.Ids) {
              rel.Ids.forEach((id: string) => childWordIds.add(id));
            }
          });
        }
      }
    });

    // Step 2: Collect WORD blocks that are not children of any LINE block
    const standaloneWordBlocks = blocks.filter((block: Block) =>
      block.BlockType === 'WORD' && !childWordIds.has(block.Id)
    );

    // Step 3: Extract text from LINE blocks
    const lineText = lineBlocks
      .map(block => block.Text || '')
      .join('\n');

    // Step 4: Extract text from standalone WORD blocks
    const wordText = standaloneWordBlocks
      .map((block: Block) => block.Text || '')
      .join(' ');

    // Step 5: Combine the text (add a newline between LINE and WORD text if both exist)
    const text = lineText + (lineText && wordText ? '\n' : '') + wordText;
    logger.info(`Stitched text (50 chars): ${text.slice(0, 50)}...`); // Log first 50 characters

    const cacheKey = `textract:${hashKey}`;
    await this.redisClient.set(cacheKey, text, 3600);
    logger.info(`cached extracted text for ${hashKey} in Redis`);

    return text;
  }

  async getTextractJobStatus(jobId: string): Promise<any> {
    const getCommand = new GetDocumentTextDetectionCommand({ JobId: jobId });
    let response;
    do {
      response = await this.textractClient.send(getCommand);
      if (response.JobStatus === 'SUCCEEDED') {
        return response;
      } else if (response.JobStatus === 'FAILED') {
        throw new Error('Textract job failed');
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    } while (response.JobStatus === 'IN_PROGRESS');
  }
}