import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AWSAuth } from '../utils/awsAuth';
import logger from '../utils/logger';
import fs from 'fs';
import { config } from '../utils/config';
import { redisClient, RedisClient } from '../utils/redisClient';

export class S3Service {
  private s3Client: S3Client;
  private redisClient: RedisClient

  constructor() {
    this.s3Client = AWSAuth.getS3Client();
    this.redisClient = redisClient;
  }

  async uploadPdfToS3(s3Key: string): Promise<{ result: any; s3Key: string } | null> {
    try {
      if (await this.redisClient.get(s3Key)) {
        logger.info(`Document already exists in Redis and S3: ${s3Key}`);
        return null;
      }
      // Create a readable stream from the PDF file
      const fileStream = fs.createReadStream('./Resume Latest.pdf');
      // const s3Key = `uploads/${file.originalname}-${Date.now()}`;
      const s3CacheKey = `s3:${s3Key}`;
      await this.redisClient.set(s3CacheKey, s3Key, 3600);
      logger.info(`uploaded file to s3: ${s3Key}`);
      logger.info(`Document uploaded to Redis: ${s3CacheKey}`);
      // Prepare the PutObjectCommand with the file stream
      const command = new PutObjectCommand({
        Bucket: config.AWS_S3_BUCKET!,
        Key: s3Key, // Desired key (filename) in S3
        Body: fileStream,
        ContentType: 'application/pdf', // Set correct MIME type for PDF
      });

      // Send the command to upload the file
      const result = await this.s3Client.send(command);
      console.log('PDF uploaded successfully:', result);

      // Optional: Handle stream errors
      fileStream.on('error', (error) => {
        console.error('Error reading file stream:', error);
      });

      return { result, s3Key };
    } catch (error) {
      console.error('Error uploading PDF to S3:', error);
      throw error;
    }
  };

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const s3Key = `uploads/${file.originalname}-${Date.now()}`;
    const command = new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
    const response = await this.s3Client.send(command);
    logger.info(`uploaded file ${file.originalname} to s3: ${s3Key}`);
    return s3Key;
  }
}
