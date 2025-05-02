
import { TextractInput, TextractOutput } from '../types/summarization.types';
import { AWSAuth } from '../utils/awsAuth';
import { DetectDocumentTextCommand, TextractClient } from '@aws-sdk/client-textract';
import { Block, Relationship } from '../types/types';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { redisClient, RedisClient } from '../utils/redisClient';
import logger from '../utils/logger';
import { config } from '../utils/config';
export class TextractService {
  private textractClient: TextractClient;
  private s3Client: S3Client;
  private redisClient: RedisClient;

  constructor() {
    this.textractClient = AWSAuth.getTextractClient();
    this.s3Client = AWSAuth.getS3Client();
    this.redisClient = redisClient;
  }

  // async extractText(s3Key: string, fileName: string): Promise<string> {
  //   const input: TextractInput = { s3Key, fileName };
  //   const output = await this.textractClient.call<TextractInput, TextractOutput>('extractText', input);
  //   logger.info(`extracted text for ${fileName}`);
  //   return output.text;
  // }

  async textract(s3Key: string): Promise<{ Blocks: any[] }> {
    const detectDocumentTextCommand = new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: config.AWS_S3_BUCKET!,
          Name: s3Key,
        }
      }
    });
    const response = await this.textractClient.send(detectDocumentTextCommand);
    logger.info(`Document text detected for: ${s3Key}`);
    logger.info(`response.Blocks: ${JSON.stringify(response.Blocks)}`);
    return { Blocks: response.Blocks || [] };
  }

  async stitchTextFromBlocks(blocks: any, s3Key: string): Promise<string> {

    if (await this.redisClient.get(s3Key)) {
      logger.info(`Document already exists in Redis and S3: ${s3Key}`);
      return (await this.redisClient.get(s3Key)) || 'No Value Found';
    }

    if (!blocks || blocks.length === 0) {
      logger.error(`No blocks found for ${s3Key}`);
      return 'No Bocks Found';
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
    logger.info(`Stitched text: ${text}`);

    const cacheKey = `textract:${s3Key}`;
    await this.redisClient.set(cacheKey, text, 3600);
    logger.info(`cached extracted text for ${s3Key}`);

    // await this.s3Client.send(new DeleteObjectCommand({
    //   Bucket: config.AWS_S3_BUCKET!,
    //   Key: s3Key,
    // }));
    // logger.info(`deleted s3 object ${s3Key}`);

    return text;
  }
}