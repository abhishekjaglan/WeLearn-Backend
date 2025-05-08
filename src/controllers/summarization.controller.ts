import { NextFunction, Request, Response } from 'express';
import { SummarizationResponse } from '../types/summarization.types.js';
import logger from '../utils/logger.js';
import { upload } from '../middleware/multer.middleware.js';
import { summarizationSchema } from '../utils/validation.js';
import { z } from 'zod';
import { AppError } from '../types/error.type.js';
import { SummarizationService } from '../services/summarization.service.js';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AWSAuth } from '../utils/awsAuth.js';
import fs from 'fs';
import { config } from '../utils/config.js';

export class SummarizationController {
  private summarizationService: SummarizationService;
  private s3Client: S3Client;

  constructor() {
    this.summarizationService = new SummarizationService();
    this.s3Client = AWSAuth.getS3Client();
  }

  async summarize(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.body.data) {
        logger.error("Request body does not contain 'data'");
        return res.status(400).json({ error: 'data required' });
      }
      if (!req.file) {
        logger.error("Request body does not contain 'file'");
        return res.status(400).json({ error: 'file required' });
      }
      const data = JSON.parse(req.body.data);
      logger.info("Parsed data: ", data);
      const { detailLevel, userId } = summarizationSchema.parse(data);
      const file = req.file;
      // const hashKey = `${file.originalname}-${userId}`;

      logger.info(`Received request to summarize file with detail level: ${detailLevel} and userId: ${userId}`);

      // await this.verifyS3File(config.AWS_S3_BUCKET!, hashKey);
      // logger.info(`File verified in S3: ${hashKey}`);
      // const filePath = './s3-download-12+Rules+to+Learn+to+Code+[2nd+Edition]+2022.pdf-1';
      // const buffer = fs.readFileSync(filePath).slice(0, 5);
      // console.log(buffer.toString('utf8'));

      // res.status(200).json({
      //   message: 'File received successfully',
      //   fileName: req.file.originalname,
      //   fileSize: req.file.size,
      //   fileType: req.file.mimetype,
      //   detailLevel,
      //   userId,
      // });

      const response: SummarizationResponse = await this.summarizationService.processFile(
        detailLevel,
        userId,
        file
      );

      res.status(200).json(response);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logger.error("Validation error:", error.errors);
        return res.status(400).json({
          success: false,
          message: "Invalid input",
          errors: error.errors,
        });
      }
      logger.error("Summarization error:", error);
      throw new AppError('Summarization error', 500);
    }
  }

  async verifyS3File(bucket: string, key: string) {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await this.s3Client.send(command);
    const body = await this.streamToBuffer(response.Body); // Convert stream to buffer
    await fs.promises.writeFile(`./s3-download-${key}`, body);
    console.log(`Downloaded S3 file as ./s3-download-${key}`);
  }

  // Helper to convert stream to buffer
  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

export const summarizationController = new SummarizationController();