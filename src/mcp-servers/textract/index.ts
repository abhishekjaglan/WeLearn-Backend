import { MCPServer } from '../../utils/mcp';
import { DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { MCPTextractInput, MCPTextractOutput } from '../../types/summarization.types';
import logger from '../../utils/logger';
import { redisClient } from '../../utils/redisClient';
import { s3Client, textractClient } from '../../utils/awsAuth';

export class TextractMCPServer {
  private server: MCPServer;

  constructor() {
    this.server = new MCPServer({
      port: parseInt(process.env.MCP_TEXTRACT_PORT!),
      auth: { type: 'none' },
    });
  }

  async start() {
    this.server.registerMethod('extractText', async (input: MCPTextractInput): Promise<MCPTextractOutput> => {
      const cacheKey = `textract:${input.fileName}`;
      const cachedText = await redisClient.get(cacheKey);
      if (cachedText) {
        logger.info(`cache hit for ${cacheKey}`);
        return { text: cachedText };
      }

      const command = new DetectDocumentTextCommand({
        Document: {
          S3Object: {
            Bucket: process.env.AWS_S3_BUCKET,
            Name: input.s3Key,
          },
        },
      });
      const response = await textractClient.send(command);
      const text = response.Blocks?.filter(b => b.BlockType === 'LINE')
        .map(b => b.Text)
        .join('\n') || '';

      await redisClient.set(cacheKey, text, 3600);  // Cache for 1 hour

      logger.info(`extracted text size for ${input.fileName}: ${text.length} characters`);

      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: input.s3Key,
      }));
      logger.info(`deleted s3 object ${input.s3Key}`);

      return { text };
    });

    await this.server.start();
    logger.info(`textract mcp server running on port ${process.env.MCP_TEXTRACT_PORT}`);
  }
}

const textractServer = new TextractMCPServer();
textractServer.start();