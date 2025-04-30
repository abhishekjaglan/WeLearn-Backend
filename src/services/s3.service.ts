import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AWSAuth } from '../utils/awsAuth';
import logger from '../utils/logger';

export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = AWSAuth.getS3Client();
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const s3Key = `uploads/${file.originalname}-${Date.now()}`;
    await this.s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    logger.info(`uploaded file ${file.originalname} to s3: ${s3Key}`);
    return s3Key;
  }
}
