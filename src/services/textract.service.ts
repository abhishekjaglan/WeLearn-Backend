
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

  async textract(hashKey: string): Promise<{ Blocks: any[], redisText: string }> {
    // Check if the document already exists in Redis
    try {
      console.log('Inside TextractService');
      const cachedKey = `textract:${hashKey}`;
      const extractedCache = await this.redisClient.get(cachedKey);
      if (extractedCache) {
        logger.info(`Extracted text already exists in Redis for: ${hashKey}`);
        return { Blocks: [], redisText: extractedCache };
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

      // ADD THIS LOGGING HERE (after line ~47)
      if (response.DocumentMetadata) {
        logger.info(`Document metadata - Pages: ${response.DocumentMetadata.Pages}`);
      }

      logger.info(`Document text detected for: ${hashKey}`);
      if (response.Blocks) {
        logger.info(`Blocks detected: ${response.Blocks.length}`);
      } else {
        logger.error(`No blocks detected for: ${hashKey}`);
      }
      return { Blocks: response.Blocks || [], redisText: '' };
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
    
    // ADD THIS DEBUG LOGGING HERE (after line ~75)
    logger.info(`=== TEXTRACT STITCHING DEBUG ===`);
    logger.info(`Processing ${blocks.length} blocks for ${hashKey}`);
    
    // Count block types for debugging
    const blockTypeCounts = blocks.reduce((acc: any, block: any) => {
      acc[block.BlockType] = (acc[block.BlockType] || 0) + 1;
      return acc;
    }, {});
    logger.info(`Block types: ${JSON.stringify(blockTypeCounts)}`);
    
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

    // ADD MORE DEBUG LOGGING HERE (before step 3)
    logger.info(`Found ${lineBlocks.length} LINE blocks`);
    logger.info(`Found ${childWordIds.size} child WORD IDs`);
    logger.info(`Found ${standaloneWordBlocks.length} standalone WORD blocks`);

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
    
    // REPLACE THE EXISTING LOG WITH ENHANCED VERSION
    logger.info(`Line text length: ${lineText.length} characters`);
    logger.info(`Word text length: ${wordText.length} characters`);
    logger.info(`Combined text length: ${text.length} characters`);
    logger.info(`Text preview (first 100 chars): ${text.slice(0, 100)}...`);
    logger.info(`Text preview (last 100 chars): ...${text.slice(-100)}`);
    logger.info(`=== END TEXTRACT STITCHING DEBUG ===`);

    const cacheKey = `textract:${hashKey}`;
    await this.redisClient.set(cacheKey, text, 3600);
    logger.info(`cached extracted text for ${hashKey} in Redis`);

    return text;
  }

  async getTextractJobStatus(jobId: string): Promise<any> {
    let allBlocks: any[] = [];
    let nextToken: string | undefined = undefined;
    let response: any;
    
    // Wait for job to complete first
    do {
      const getCommand = new GetDocumentTextDetectionCommand({ JobId: jobId });
      response = await this.textractClient.send(getCommand);
      
      if (response.JobStatus === 'SUCCEEDED') {
        break;
      } else if (response.JobStatus === 'FAILED') {
        throw new Error(`Textract job failed: ${response.StatusMessage}`);
      }
      
      logger.info(`Job status: ${response.JobStatus}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    } while (response.JobStatus === 'IN_PROGRESS');
    
    // Now fetch ALL pages of results with pagination
    do {
      const getCommand = new GetDocumentTextDetectionCommand({ 
        JobId: jobId,
        ...(nextToken && { NextToken: nextToken })
      });
      
      response = await this.textractClient.send(getCommand);
      
      if (response.Blocks) {
        allBlocks = allBlocks.concat(response.Blocks);
        logger.info(`Fetched ${response.Blocks.length} blocks, total so far: ${allBlocks.length}`);
      }
      
      nextToken = response.NextToken;
      logger.info(`NextToken exists: ${!!nextToken}`);
      
    } while (nextToken);
    
    logger.info(`Final total blocks collected: ${allBlocks.length}`);
    
    return {
      ...response,
      Blocks: allBlocks
    };
  }
}