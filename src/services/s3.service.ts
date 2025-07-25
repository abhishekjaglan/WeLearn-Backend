import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AWSAuth } from '../utils/awsAuth.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import { config } from '../utils/config.js';
import { redisClient, RedisClient } from '../utils/redisClient.js';

export class S3Service {
  private s3Client: S3Client;
  private redisClient: RedisClient

  constructor() {
    this.s3Client = AWSAuth.getS3Client();
    this.redisClient = redisClient;
  }

  async uploadFileToS3(hashKey: string, file: Express.Multer.File): Promise<{ result: any } | null> {
    try {
      const s3CacheKey = `s3:${hashKey}`;
      const s3cache = await this.redisClient.get(s3CacheKey);
      if (s3cache) {
        logger.info(`Cache Hit - Document already exists in Redis and S3: ${hashKey}`);
        return null;
      }

      const fileType = file.mimetype.split('/')[1]
      const command = new PutObjectCommand({
        Bucket: config.AWS_S3_BUCKET!,
        Key: hashKey, // Desired key (filename) in S3
        Body: file.buffer,
        ContentType: file.mimetype, // Set correct MIME type for PDF
      });

      // Send the command to upload the file
      const result = await this.s3Client.send(command);
      console.log(`${fileType} - ${file.originalname} with hashkey ${hashKey} uploaded successfully:`, result);

      await this.redisClient.set(s3CacheKey, hashKey, 3600);
      logger.info(`Document uploaded to Redis: ${s3CacheKey}`);

      return { result };
    } catch (error) {
      console.error('Error uploading PDF to S3:', error);
      throw error;
    }
  };
};
